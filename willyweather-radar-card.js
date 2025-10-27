/**
 * WillyWeather Radar Card
 */

import { LitElement, html, css } from "https://unpkg.com/lit@3.1.0/index.js?module";

class WillyWeatherRadarCard extends LitElement {
  constructor() {
    super();
    // Initialize state early
    this._isVisible = true;
    this._currentFrame = 0;
    this._timestamps = [];
    this._loading = false;
    this._currentMapType = null;
  }

  static getStubConfig() {
    return {
      zoom: 10,
      frames: 7
    };
  }

  static getConfigElement() {
    return document.createElement("willyweather-radar-card-editor");
  }

  static getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_rows: 6,
      grid_min_columns: 2,
      grid_max_columns: 4,
      grid_min_rows: 4,
      grid_max_rows: 10
    };
  }

  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _currentFrame: { type: Number, state: true },
      _timestamps: { type: Array, state: true },
      _loading: { type: Boolean, state: true },
      _isVisible: { type: Boolean, state: true }
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }

    const oldConfig = this.config;
    
    this.config = {
      zoom: config.zoom || 10,
      frames: config.frames || 7,
      ...config
    };

    // If this is a config update after initial load, handle zoom change
    if (oldConfig && this._map) {
      if (oldConfig.zoom !== this.config.zoom) {
        this._map.setZoom(this.config.zoom);
      }
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
        height: 100%;
      }

      ha-card {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .card-content {
        flex: 1;
        padding: 0;
        position: relative;
        overflow: hidden;
      }

      #map {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
      }

      .timestamp {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(255, 255, 255, 0.95);
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        z-index: 1000;
        pointer-events: none;
      }

      .progress-bar {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(255, 255, 255, 0.95);
        padding: 8px 12px;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        z-index: 1000;
        pointer-events: none;
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .progress-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.2);
        transition: background 0.3s ease;
      }

      .progress-dot.active {
        background: #1976D2;
      }

      .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 1001;
      }

      .home-marker {
        color: #1976D2;
        font-size: 24px;
        text-shadow: 0 0 3px white, 0 0 6px white;
      }
    `;
  }

  render() {
    return html`
      <ha-card>
        <div class="card-content">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <div id="map"></div>
          
          ${this._loading ? html`<div class="loading">Loading...</div>` : ''}
          
          ${this._timestamps.length > 0 ? html`
            <div class="timestamp">
              ${this._formatTimestamp(this._timestamps[this._currentFrame])}
            </div>
            <div class="progress-bar">
              ${this._timestamps.map((_, index) => html`
                <div class="progress-dot ${index === this._currentFrame ? 'active' : ''}"></div>
              `)}
            </div>
          ` : ''}
        </div>
      </ha-card>
    `;
  }

  async firstUpdated() {
    await this._initialize();
  }

  async updated(changedProperties) {
    super.updated(changedProperties);
    
    // If config changed and map doesn't exist yet, initialize
    if (changedProperties.has('config') && !this._map) {
      await this._initialize();
    }
  }

  async _initialize() {
    await this._loadLeaflet();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!this._map) {
      this._initMap();
      await this._startAutoUpdate();
      this._setupVisibilityObserver();
      this._setupPageVisibility();
    }
  }

  async _loadLeaflet() {
    if (window.L) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  _initMap() {
    const mapElement = this.shadowRoot.getElementById('map');
    if (!mapElement) return;
    
    const homeZone = this.hass?.states['zone.home'];
    const lat = homeZone?.attributes?.latitude || -33.8688;
    const lng = homeZone?.attributes?.longitude || 151.2093;

    this._map = L.map(mapElement, {
      zoomControl: true,
      attributionControl: true
    }).setView([lat, lng], this.config.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(this._map);

    // Add home marker
    const homeIcon = L.divIcon({
      html: '<div class="home-marker">🏠</div>',
      className: 'home-marker-container',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this._homeMarker = L.marker([lat, lng], { 
      icon: homeIcon,
      interactive: false,
      zIndexOffset: 1000
    }).addTo(this._map);

    setTimeout(() => this._map?.invalidateSize(), 200);
    
    // Reload timestamps when zoom changes
    this._map.on('zoomend', () => {
      this._loadTimestamps();
    });
    
    // In _initMap(), update the moveend handler:
    this._map.on('moveend', () => {
      const currentCenter = this._map.getCenter();
      const lockedCenter = this._lockedCenter || this._lastCenter;
      
      if (lockedCenter) {
        const distance = currentCenter.distanceTo(lockedCenter);
        if (distance > 50000) {
          console.log('Map moved significantly, reloading timestamps');
          this._loadTimestamps();
        }
      }
    });
  }

  async _startAutoUpdate() {
    await this._loadTimestamps();
    
    this._startAnimation();

    this._reloadInterval = setInterval(() => this._loadTimestamps(), 300000);
  }

  _startAnimation() {
    // Clear any existing animation
    if (this._animationInterval) {
      clearInterval(this._animationInterval);
      this._animationInterval = null;
    }

    // Only start if card is visible
    if (!this._isVisible) {
      console.log('Skipping animation start - card not visible');
      return;
    }

    console.log('Starting animation');

    // Start new animation
    this._animationInterval = setInterval(() => {
      if (this._timestamps.length > 0 && this._isVisible) {
        this._currentFrame = (this._currentFrame + 1) % Math.min(this.config.frames, this._timestamps.length);
        this._updateRadar();
      }
    }, 1500);
  }

  _stopAnimation() {
    if (this._animationInterval) {
      clearInterval(this._animationInterval);
      this._animationInterval = null;
      console.log('Animation stopped');
    }
  }

  _setupVisibilityObserver() {
    // Use Intersection Observer to detect when card is visible
    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Card is visible - resume animation
            console.log('Card visible - resuming animation');
            this._isVisible = true;
            if (this._timestamps.length > 0 && !this._animationInterval) {
              this._startAnimation();
            }
          } else {
            // Card is hidden - pause animation
            console.log('Card hidden - pausing animation');
            this._isVisible = false;
            this._stopAnimation();
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    // Observe the card element
    this._intersectionObserver.observe(this);
  }

  _setupPageVisibility() {
    // Pause animation when browser tab is hidden
    this._handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab hidden - pausing animation');
        this._stopAnimation();
      } else if (this._isVisible) {
        console.log('Tab visible - resuming animation');
        this._startAnimation();
      }
    };

    document.addEventListener('visibilitychange', this._handleVisibilityChange);
  }

  _getMapType(zoom) {
    // MUST MATCH SERVER LOGIC EXACTLY
    const zoomRadius = 5000 / Math.pow(2, zoom - 5);
    return zoomRadius > 160 ? 'radar' : 'regional-radar';
  }

  _clearAllOverlays() {
    // Remove ALL image overlays from the map
    if (this._map) {
      this._map.eachLayer((layer) => {
        if (layer instanceof L.ImageOverlay) {
          this._map.removeLayer(layer);
        }
      });
    }
    
    // Clear stored references
    this._overlay = null;
    
    // Clean up blob URLs
    if (this._lastImageUrl) {
      URL.revokeObjectURL(this._lastImageUrl);
      this._lastImageUrl = null;
    }
  }

  async _loadTimestamps() {
    if (!this._map) return;
  
    try {
      // Cancel any pending requests
      if (this._abortController) {
        this._abortController.abort();
      }
      this._abortController = new AbortController();
      
      this._stopAnimation();
      this._loading = true;
  
      this._lockedCenter = this._map.getCenter();
      this._lockedZoom = this._map.getZoom();
  
      console.log(`Loading timestamps: center=(${this._lockedCenter.lat.toFixed(4)}, ${this._lockedCenter.lng.toFixed(4)}), zoom=${this._lockedZoom}`);
  
      const url = this._getAddonUrl(`/api/timestamps?lat=${this._lockedCenter.lat}&lng=${this._lockedCenter.lng}&zoom=${this._lockedZoom}`);
      const response = await fetch(url, { 
        signal: this._abortController.signal  // Add abort signal
      });
      
      if (!response.ok) throw new Error('Failed to load timestamps');
  
      const allTimestamps = await response.json();
      this._timestamps = allTimestamps.slice(-this.config.frames);
      this._currentFrame = 0;
      
      this._clearAllOverlays();
      await this._updateRadar();
      this._startAnimation();
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
        return;
      }
      console.error('Error loading timestamps:', error);
      this._timestamps = [];
    } finally {
      this._loading = false;
    }
  }
  
  async _updateRadar() {
    if (!this._map) return;
  
    try {
      // Cancel previous radar fetch
      if (this._radarAbortController) {
        this._radarAbortController.abort();
      }
      this._radarAbortController = new AbortController();
      
      // DON'T remove old overlay yet - wait until new one is ready
      
      const center = this._lockedCenter || this._map.getCenter();
      const zoom = this._lockedZoom || this._map.getZoom();
      const timestamp = this._timestamps[this._currentFrame];
      
      if (!timestamp) {
        console.log('No timestamp available for current frame');
        return;
      }
  
      const timestampParam = `&timestamp=${encodeURIComponent(timestamp)}`;
      const url = this._getAddonUrl(`/api/radar?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}${timestampParam}`);
  
      console.log(`Fetching radar: frame=${this._currentFrame}, timestamp=${timestamp}`);
  
      const response = await fetch(url, {
        signal: this._radarAbortController.signal,
      });
      
      if (!response.ok) {
        console.error('Failed to fetch radar:', response.status);
        return;
      }
  
      const south = parseFloat(response.headers.get('X-Radar-Bounds-South'));
      const west = parseFloat(response.headers.get('X-Radar-Bounds-West'));
      const north = parseFloat(response.headers.get('X-Radar-Bounds-North'));
      const east = parseFloat(response.headers.get('X-Radar-Bounds-East'));
  
      if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
        console.error('Invalid bounds from addon');
        return;
      }
  
      const bounds = L.latLngBounds(
        L.latLng(south, west),
        L.latLng(north, east)
      );
  
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
  
      // Create new overlay FIRST
      const newOverlay = L.imageOverlay(imageUrl, bounds, {
        opacity: 0.7,
        interactive: false
      });
      
      // Add new overlay to map
      newOverlay.addTo(this._map);
  
      // NOW remove old overlay (new one is already visible)
      if (this._overlay) {
        this._map.removeLayer(this._overlay);
      }
      if (this._lastImageUrl) {
        URL.revokeObjectURL(this._lastImageUrl);
      }
      
      // Update references
      this._overlay = newOverlay;
      this._lastImageUrl = imageUrl;
  
      console.log('Radar overlay added successfully');
  
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Radar fetch cancelled');
        return;
      }
      console.error('Error updating radar:', error);
    }
  }
  
    _getAddonUrl(path) {
    // Use direct port access
    return `http://homeassistant.local:8099${path}`;
  }

  _formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    // Parse UTC timestamp from server
    const date = new Date(timestamp + ' UTC');
    
    // Convert to local time and format
    return date.toLocaleString('en-AU', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Melbourne'
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Cancel any pending requests
    if (this._abortController) {
      this._abortController.abort();
    }
    if (this._radarAbortController) {
      this._radarAbortController.abort();
    }
    
    // Clean up page visibility listener
    if (this._handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    }
    
    // Clean up intersection observer
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }
    
    this._stopAnimation();
    
    if (this._reloadInterval) {
      clearInterval(this._reloadInterval);
    }
    
    this._clearAllOverlays();
    
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
  }
  
  getCardSize() {
    return 5;
  }
}

class WillyWeatherRadarCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object }
    };
  }

  setConfig(config) {
    this.config = config;
  }

  static get styles() {
    return css`
      .option {
        padding: 16px 0;
      }

      .option label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }

      ha-textfield {
        width: 100%;
      }
    `;
  }

  render() {
    if (!this.config) {
      return html``;
    }

    return html`
      <div class="option">
        <label>Initial Zoom Level (1-15)</label>
        <ha-textfield
          type="number"
          .value=${this.config.zoom || 10}
          .min=${1}
          .max=${15}
          @input=${this._valueChanged}
          .configValue=${"zoom"}
        ></ha-textfield>
      </div>
      <div class="option">
        <label>Animation Frames (3-10)</label>
        <ha-textfield
          type="number"
          .value=${this.config.frames || 7}
          .min=${3}
          .max=${10}
          @input=${this._valueChanged}
          .configValue=${"frames"}
        ></ha-textfield>
      </div>
    `;
  }

  _valueChanged(ev) {
    if (!this.config || !this.hass) {
      return;
    }

    const target = ev.target;
    const configValue = target.configValue;
    const value = parseInt(target.value);

    if (this.config[configValue] === value) {
      return;
    }

    const newConfig = {
      ...this.config,
      [configValue]: value
    };

    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
}

customElements.define("willyweather-radar-card", WillyWeatherRadarCard);
customElements.define("willyweather-radar-card-editor", WillyWeatherRadarCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "willyweather-radar-card",
  name: "WillyWeather Radar Card",
  description: "Australian weather radar with auto-animation"
});

console.info("%c WILLYWEATHER-RADAR-CARD %c 1.1.0 ", "color: white; background: #1976D2; font-weight: 700;", "color: white; background: #424242;");
