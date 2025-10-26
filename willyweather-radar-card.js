/**
 * WillyWeather Radar Card
 * Displays Australian weather radar with auto-animation
 */

import { LitElement, html, css } from "https://unpkg.com/lit@3.1.0/index.js?module";

class WillyWeatherRadarCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _currentFrame: { type: Number, state: true },
      _timestamps: { type: Array, state: true },
      _loading: { type: Boolean, state: true }
    };
  }

  static getStubConfig() {
    return {
      zoom: 10,
      addon_slug: "willyweather_radar",
      height: 400
    };
  }

  static getConfigElement() {
    return document.createElement("willyweather-radar-card-editor");
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }

    this.config = {
      zoom: config.zoom || 10,
      addon_slug: config.addon_slug || "willyweather_radar",
      height: config.height || 400,
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
        overflow: hidden;
      }

      .card-content {
        padding: 0;
        position: relative;
        height: var(--map-height, 400px);
        overflow: hidden;
      }

      #map {
        width: 100%;
        height: 100%;
      }

      .timestamp {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(255, 255, 255, 0.95);
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
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

      /* Leaflet CSS inline for shadow DOM */
      #map :global(.leaflet-pane),
      #map :global(.leaflet-tile),
      #map :global(.leaflet-marker-icon),
      #map :global(.leaflet-marker-shadow),
      #map :global(.leaflet-tile-container),
      #map :global(.leaflet-zoom-box),
      #map :global(.leaflet-image-layer),
      #map :global(.leaflet-layer) {
        position: absolute;
        left: 0;
        top: 0;
      }

      #map :global(.leaflet-container) {
        overflow: hidden;
        background: #ddd;
      }

      #map :global(.leaflet-tile),
      #map :global(.leaflet-marker-icon),
      #map :global(.leaflet-marker-shadow) {
        user-select: none;
      }

      #map :global(.leaflet-tile-container) {
        z-index: 2;
      }

      #map :global(.leaflet-control-zoom a) {
        width: 26px;
        height: 26px;
        line-height: 26px;
        display: block;
        text-align: center;
        text-decoration: none;
        color: black;
        background-color: #fff;
      }

      #map :global(.leaflet-control-zoom) {
        box-shadow: 0 1px 5px rgba(0,0,0,0.4);
        border-radius: 4px;
      }

      #map :global(.leaflet-bar) {
        box-shadow: 0 1px 5px rgba(0,0,0,0.4);
        border-radius: 4px;
      }

      #map :global(.leaflet-bar a) {
        background-color: #fff;
        border-bottom: 1px solid #ccc;
        width: 26px;
        height: 26px;
        line-height: 26px;
        display: block;
        text-align: center;
        text-decoration: none;
        color: black;
      }

      #map :global(.leaflet-control-attribution) {
        background: rgba(255, 255, 255, 0.7);
        padding: 0 5px;
        font-size: 11px;
      }
    `;
  }

  render() {
    return html`
      <ha-card>
        <div class="card-content" style="--map-height: ${this.config.height}px">
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
    
    // Get Home Assistant home zone coordinates
    const homeZone = this.hass.states['zone.home'];
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

    // Update radar when user pans/zooms
    this._map.on('moveend', () => this._loadTimestamps());
  }

  async _startAutoUpdate() {
    await this._loadTimestamps();
    
    // Auto-cycle through frames every 800ms
    this._animationInterval = setInterval(() => {
      if (this._timestamps.length > 0) {
        this._currentFrame = (this._currentFrame + 1) % Math.min(5, this._timestamps.length);
        this._updateRadar();
      }
    }, 800);

    // Reload timestamps every 5 minutes
    this._reloadInterval = setInterval(() => {
      this._loadTimestamps();
    }, 300000);
  }

  async _loadTimestamps() {
    try {
      this._loading = true;

      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const zoomRadius = 5000 / Math.pow(2, zoom - 5);
      const mapType = zoomRadius > 1500 ? 'radar' : 'regional-radar';

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
    try {
      if (this._overlay) {
        this._map.removeLayer(this._overlay);
      }

      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const timestamp = this._timestamps[this._currentFrame];
      
      if (!timestamp) return;

      const timestampParam = `&timestamp=${encodeURIComponent(timestamp)}`;
      const url = this._getAddonUrl(`/api/radar?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}${timestampParam}`);

      const bounds = this._map.getBounds();
      this._overlay = L.imageOverlay(url, bounds, {
        opacity: 0.7,
        interactive: false
      }).addTo(this._map);

    } catch (error) {
      console.error('Error updating radar:', error);
    }
  }

  _getAddonUrl(path) {
    return `/api/hassio_ingress/${this.config.addon_slug}${path}`;
  }

  _formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-AU', { 
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
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
  }

  getCardSize() {
    return Math.ceil(this.config.height / 50);
  }

  static getLayoutOptions() {
    return {
      grid_rows: 4,
      grid_columns: 2,
      grid_min_rows: 3,
      grid_max_rows: 6,
      grid_min_columns: 2,
      grid_max_columns: 4
    };
  }
}

customElements.define("willyweather-radar-card", WillyWeatherRadarCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "willyweather-radar-card",
  name: "WillyWeather Radar Card",
  description: "Australian weather radar with auto-animation"
});

console.info("%c WILLYWEATHER-RADAR-CARD %c 1.0.0 ", "color: white; background: #1976D2; font-weight: 700;", "color: white; background: #424242;");
