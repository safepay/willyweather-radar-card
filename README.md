# WillyWeather Radar Card

Custom Lovelace card for Home Assistant displaying Australian weather radar with automatic animation.

## Features

- 🗺️ Auto-centers on Home Assistant home zone
- 🎬 Auto-animates latest 5 radar frames
- 🔄 Updates radar as you pan/zoom
- 📍 Works with Home Assistant Sections layouts
- ⚡ No controls needed - just works

## Prerequisites

Install and configure the [WillyWeather Radar Add-on](https://github.com/safepay/willyweather-radar-addon)

## Installation

### HACS

1. Add custom repository: `https://github.com/safepay/willyweather-radar-card`
2. Install "WillyWeather Radar Card"
3. Restart Home Assistant

### Manual

1. Download `willyweather-radar-card.js`
2. Copy to `config/www/willyweather-radar-card.js`
3. Add resource:
   - Settings → Dashboards → Resources → Add Resource
   - URL: `/local/willyweather-radar-card.js`
   - Type: JavaScript Module
4. Restart Home Assistant

## Usage

### Basic (uses your home zone location)

```yaml
type: custom:willyweather-radar-card
```

### Custom Configuration

```yaml
type: custom:willyweather-radar-card
zoom: 10              # Default: 10 (1-15)
height: 400           # Default: 400 (pixels)
addon_slug: willyweather_radar  # Default
```

### In Sections Layout

```yaml
type: custom:willyweather-radar-card
zoom: 11
height: 500
```

## How It Works

1. Automatically finds your home zone coordinates
2. Loads latest 5 radar frames from addon
3. Cycles through frames every 800ms
4. Updates when you pan/zoom the map
5. Refreshes data every 5 minutes

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `zoom` | number | 10 | Initial zoom level (1-15) |
| `height` | number | 400 | Map height in pixels |
| `addon_slug` | string | willyweather_radar | Addon slug |

## Troubleshooting

**Card not showing:**
- Verify addon is running
- Check browser console (F12) for errors
- Clear browser cache

**No radar data:**
- Check addon logs
- Verify API key configured in addon
- Ensure coordinates are in Australia

**Map not loading:**
- Check internet connection (needs OpenStreetMap)
- Clear browser cache

## License

MIT License

## Credits

- Weather data: [WillyWeather](https://www.willyweather.com.au/)
- Map tiles: [OpenStreetMap](https://www.openstreetmap.org/)
- Built with [Leaflet.js](https://leafletjs.com/)

## Related

- [WillyWeather Radar Add-on](https://github.com/safepay/willyweather-radar-addon)
