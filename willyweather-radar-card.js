/**
 * WillyWeather Radar Card
 */

import { LitElement, html, css } from "https://unpkg.com/lit@3.1.0/index.js?module";

class WillyWeatherRadarCard extends LitElement {
  static getStubConfig() {
    return {
      zoom: 10
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
      _loading: { type: Boolean, state: true }
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }

    this.config = {
      zoom: config.zoom || 10,
      ...config
    };

    this._currentFrame = 0;
    this._timestamps = [];
    this._loading = false;
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
          ` : ''}
        </div>
      </ha-card>
    `;
  }

  async firstUpdated() {
    await this._loadLeaflet();
    await new Promise(resolve => setTimeout(resolve, 100));
    this._initMap();
    await this._startAutoUpdate();
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

    setTimeout(() => this._map?.invalidateSize(), 200);
    
    // Reload timestamps when zoom changes
    this._map.on('zoomend', () => {
      this._loadTimestamps();
    });
    
    // Reload when panning more than 50km
    this._map.on('moveend', () => {
      const currentCenter = this._map.getCenter();
      if (this._lastCenter) {
        const distance = currentCenter.distanceTo(this._lastCenter);
        if (distance > 50000) {
          this._loadTimestamps();
        }
      }
    });
  }

  async _startAutoUpdate() {
    await this._loadTimestamps();
    
    this._animationInterval = setInterval(() => {
      if (this._timestamps.length > 0) {
        this._currentFrame = (this._currentFrame + 1) % Math.min(5, this._timestamps.length);
        this._updateRadar();
      }
    }, 800);

    this._reloadInterval = setInterval(() => this._loadTimestamps(), 300000);
  }

  async _loadTimestamps() {
    if (!this._map) return;

    try {
      this._loading = true;

      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const zoomRadius = 5000 / Math.pow(2, zoom - 5);
      const mapType = zoomRadius > 160 ? 'radar' : 'regional-radar';

      const url = this._getAddonUrl(`/api/timestamps?lat=${center.lat}&lng=${center.lng}&type=${mapType}`);
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Failed to load timestamps');

      const allTimestamps = await response.json();
      this._timestamps = allTimestamps.slice(-5);
      this._currentFrame = 0;
      
      await this._updateRadar();
      
    } catch (error) {
      console.error('Error loading timestamps:', error);
      this._timestamps = [];
    } finally {
      this._loading = false;
    }
  }

  async _updateRadar() {
    if (!this._map) return;

    try {
      // Remove old overlay
      if (this._overlay) {
        this._map.removeLayer(this._overlay);
      }

      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const timestamp = this._timestamps[this._currentFrame];
      
      if (!timestamp) return;

      const timestampParam = `&timestamp=${encodeURIComponent(timestamp)}`;
      const url = this._getAddonUrl(`/api/radar?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}${timestampParam}`);

      // Fetch radar image
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Failed to fetch radar:', response.status);
        return;
      }

      // Read bounds from response headers (addon provides actual geographic bounds)
      const south = parseFloat(response.headers.get('X-Radar-Bounds-South'));
      const west = parseFloat(response.headers.get('X-Radar-Bounds-West'));
      const north = parseFloat(response.headers.get('X-Radar-Bounds-North'));
      const east = parseFloat(response.headers.get('X-Radar-Bounds-East'));

      if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
        console.error('Invalid bounds from addon');
        return;
      }

      // Create Leaflet bounds from actual radar coverage area
      const bounds = L.latLngBounds(
        L.latLng(south, west),
        L.latLng(north, east)
      );

      // Create image URL from blob
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      // Add overlay at the correct geographic position
      this._overlay = L.imageOverlay(imageUrl, bounds, {
        opacity: 0.7,
        interactive: false
      }).addTo(this._map);

      // Clean up old image URL
      if (this._lastImageUrl) {
        URL.revokeObjectURL(this._lastImageUrl);
      }
      this._lastImageUrl = imageUrl;

      // Store current position for pan detection
      this._lastCenter = center;

    } catch (error) {
      console.error('Error updating radar:', error);
    }
  }

  _getAddonUrl(path) {
    // Use direct port access
    return `http://homeassistant.local:8099${path}`;
  }

  _formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-AU', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    if (this._animationInterval) {
      clearInterval(this._animationInterval);
    }
    if (this._reloadInterval) {
      clearInterval(this._reloadInterval);
    }
    if (this._lastImageUrl) {
      URL.revokeObjectURL(this._lastImageUrl);
    }
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

console.info("%c WILLYWEATHER-RADAR-CARD %c 1.0.1 ", "color: white; background: #1976D2; font-weight: 700;", "color: white; background: #424242;");
