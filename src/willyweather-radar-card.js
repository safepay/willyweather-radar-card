/**
 * WillyWeather Radar Card
 * 
 * A custom Lovelace card for displaying Australian weather radar from WillyWeather.
 * Requires the WillyWeather Radar add-on to be installed and configured.
 */

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class WillyWeatherRadarCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _map: {},
      _overlay: {},
      _playing: { type: Boolean },
      _currentFrame: { type: Number },
      _timestamps: { type: Array },
      _loading: { type: Boolean }
    };
  }

  static getStubConfig() {
    return {
      entity: "",
      latitude: -33.8688,
      longitude: 151.2093,
      zoom: 10,
      show_animation: true,
      animation_speed: 500,
      show_controls: true,
      show_timestamp: true,
      addon_slug: "willyweather_radar"
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }

    this.config = {
      latitude: config.latitude || -33.8688,
      longitude: config.longitude || 151.2093,
      zoom: config.zoom || 10,
      show_animation: config.show_animation !== false,
      animation_speed: config.animation_speed || 500,
      show_controls: config.show_controls !== false,
      show_timestamp: config.show_timestamp !== false,
      addon_slug: config.addon_slug || "willyweather_radar",
      entity: config.entity || "",
      ...config
    };

    this._playing = false;
    this._currentFrame = 0;
    this._timestamps = [];
    this._loading = false;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .card-content {
        padding: 0;
        position: relative;
        overflow: hidden;
      }

      #map {
        width: 100%;
        height: 400px;
      }

      .controls {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 1000;
      }

      .controls button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .controls button:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .controls ha-icon {
        --mdc-icon-size: 24px;
      }

      .timestamp {
        position: absolute;
        top: 16px;
        right: 16px;
        background: rgba(255, 255, 255, 0.9);
        padding: 8px 12px;
        border-radius: 4px;
        font-weight: 500;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 1000;
      }

      .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.9);
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 1001;
      }

      .error {
        padding: 16px;
        background: #ff5252;
        color: white;
        text-align: center;
      }
    `;
  }

  render() {
    if (this._error) {
      return html`
        <ha-card>
          <div class="error">${this._error}</div>
        </ha-card>
      `;
    }

    return html`
      <ha-card>
        <div class="card-content">
          <div id="map"></div>
          
          ${this._loading ? html`
            <div class="loading">Loading radar data...</div>
          ` : ''}
          
          ${this.config.show_timestamp && this._timestamps.length > 0 ? html`
            <div class="timestamp">
              ${this._timestamps[this._currentFrame] || 'No data'}
            </div>
          ` : ''}
          
          ${this.config.show_controls && this.config.show_animation && this._timestamps.length > 1 ? html`
            <div class="controls">
              <button @click=${this._previousFrame}>
                <ha-icon icon="mdi:skip-previous"></ha-icon>
              </button>
              
              <button @click=${this._togglePlay}>
                <ha-icon icon="${this._playing ? 'mdi:pause' : 'mdi:play'}"></ha-icon>
              </button>
              
              <button @click=${this._nextFrame}>
                <ha-icon icon="mdi:skip-next"></ha-icon>
              </button>
              
              <button @click=${this._refresh}>
                <ha-icon icon="mdi:refresh"></ha-icon>
              </button>
            </div>
          ` : ''}
        </div>
      </ha-card>
    `;
  }

  async firstUpdated() {
    await this._loadLeaflet();
    this._initMap();
    await this._loadTimestamps();
    await this._updateRadar();
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this.config.entity) {
      const entityState = this.hass.states[this.config.entity];
      if (entityState) {
        // Update map center if entity provides location
        if (entityState.attributes.latitude && entityState.attributes.longitude) {
          const newLat = entityState.attributes.latitude;
          const newLng = entityState.attributes.longitude;
          
          if (this._map && (newLat !== this.config.latitude || newLng !== this.config.longitude)) {
            this.config.latitude = newLat;
            this.config.longitude = newLng;
            this._map.setView([newLat, newLng], this._map.getZoom());
            this._updateRadar();
          }
        }
      }
    }
  }

  async _loadLeaflet() {
    // Check if Leaflet is already loaded
    if (window.L) return;

    // Load Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    // Load Leaflet JS
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
    
    this._map = L.map(mapElement, {
      zoomControl: true,
      attributionControl: true
    }).setView([this.config.latitude, this.config.longitude], this.config.zoom);

    // Add base map layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this._map);

    // Listen for map movements
    this._map.on('moveend zoomend', () => {
      this._updateRadar();
    });
  }

  async _loadTimestamps() {
    try {
      this._loading = true;
      this.requestUpdate();

      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const zoomRadius = 5000 / Math.pow(2, zoom - 5);
      const mapType = zoomRadius > 1500 ? 'radar' : 'regional-radar';

      const url = this._getAddonUrl(`/api/timestamps?lat=${center.lat}&lng=${center.lng}&type=${mapType}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to load timestamps');
      }

      this._timestamps = await response.json();
      this._currentFrame = Math.max(0, this._timestamps.length - 1);
      
    } catch (error) {
      console.error('Error loading timestamps:', error);
      this._timestamps = [];
    } finally {
      this._loading = false;
      this.requestUpdate();
    }
  }

  async _updateRadar() {
    try {
      const center = this._map.getCenter();
      const zoom = this._map.getZoom();

      // Remove existing overlay
      if (this._overlay) {
        this._map.removeLayer(this._overlay);
      }

      const timestamp = this._timestamps[this._currentFrame];
      const timestampParam = timestamp ? `&timestamp=${encodeURIComponent(timestamp)}` : '';
      const url = this._getAddonUrl(`/api/radar?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}${timestampParam}`);

      // Create image overlay
      const bounds = this._map.getBounds();
      this._overlay = L.imageOverlay(url, bounds, {
        opacity: 0.7,
        interactive: false
      }).addTo(this._map);

      // Update overlay when map moves
      this._map.on('moveend', () => {
        if (this._overlay) {
          this._overlay.setBounds(this._map.getBounds());
        }
      });

    } catch (error) {
      console.error('Error updating radar:', error);
      this._error = 'Failed to load radar data';
      this.requestUpdate();
    }
  }

  _getAddonUrl(path) {
    // Get ingress URL from Home Assistant
    const ingressBase = `/api/hassio_ingress/${this.config.addon_slug}`;
    return `${ingressBase}${path}`;
  }

  _togglePlay() {
    this._playing = !this._playing;
    
    if (this._playing) {
      this._startAnimation();
    } else {
      this._stopAnimation();
    }
    
    this.requestUpdate();
  }

  _startAnimation() {
    if (this._animationInterval) return;
    
    this._animationInterval = setInterval(() => {
      this._nextFrame();
    }, this.config.animation_speed);
  }

  _stopAnimation() {
    if (this._animationInterval) {
      clearInterval(this._animationInterval);
      this._animationInterval = null;
    }
  }

  _nextFrame() {
    if (this._timestamps.length === 0) return;
    
    this._currentFrame = (this._currentFrame + 1) % this._timestamps.length;
    this._updateRadar();
    this.requestUpdate();
  }

  _previousFrame() {
    if (this._timestamps.length === 0) return;
    
    this._currentFrame = (this._currentFrame - 1 + this._timestamps.length) % this._timestamps.length;
    this._updateRadar();
    this.requestUpdate();
  }

  async _refresh() {
    this._stopAnimation();
    this._playing = false;
    await this._loadTimestamps();
    await this._updateRadar();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopAnimation();
    
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
  }

  getCardSize() {
    return 5;
  }
}

customElements.define("willyweather-radar-card", WillyWeatherRadarCard);

// Add card to custom card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "willyweather-radar-card",
  name: "WillyWeather Radar Card",
  description: "Display Australian weather radar from WillyWeather",
  preview: true,
  documentationURL: "https://github.com/yourusername/willyweather-radar-card"
});

console.info(
  "%c WILLYWEATHER-RADAR-CARD %c 1.0.0 ",
  "color: white; background: #1976D2; font-weight: 700;",
  "color: white; background: #424242; font-weight: 700;"
);
