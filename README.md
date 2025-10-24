# WillyWeather Radar Card

A custom Lovelace card for Home Assistant that displays Australian weather radar imagery from WillyWeather.com.au with animation and intelligent multi-radar blending.

![WillyWeather Radar Card](https://via.placeholder.com/800x400?text=WillyWeather+Radar+Card)

## Features

- 🗺️ **Interactive Map**: Pan and zoom to any location in Australia
- 🎬 **Radar Animation**: Play through recent radar frames
- 🎯 **Smart Radar Selection**: Automatically switches between regional and national radar
- 🔄 **Auto-refresh**: Updates with latest radar data
- 📍 **Entity Tracking**: Follow a device tracker or person entity
- ⚡ **Fast Loading**: Efficient caching and image loading
- 🎨 **Customizable**: Configure zoom, animation speed, and controls

## Prerequisites

This card requires the **WillyWeather Radar Add-on** to be installed and configured. The add-on handles fetching and serving radar data from WillyWeather's API.

👉 [Install WillyWeather Radar Add-on](https://github.com/yourusername/willyweather-radar-addon)

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click on "Frontend"
3. Click the three dots menu and select "Custom repositories"
4. Add `https://github.com/yourusername/willyweather-radar-card` as a "Lovelace" repository
5. Click "Install"
6. Restart Home Assistant

### Manual Installation

1. Download `willyweather-radar-card.js` from the [latest release](https://github.com/yourusername/willyweather-radar-card/releases)
2. Copy it to `<config>/www/willyweather-radar-card.js`
3. Add the resource in your Lovelace dashboard:
   - Go to **Settings** → **Dashboards** → **Resources**
   - Click **Add Resource**
   - URL: `/local/willyweather-radar-card.js`
   - Resource type: **JavaScript Module**
4. Restart Home Assistant

## Usage

### Basic Configuration

Add the card to your Lovelace dashboard:

```yaml
type: custom:willyweather-radar-card
latitude: -33.8688
longitude: 151.2093
zoom: 10
```

### Full Configuration

```yaml
type: custom:willyweather-radar-card
# Location settings
latitude: -33.8688              # Default: -33.8688 (Sydney)
longitude: 151.2093             # Default: 151.2093 (Sydney)
zoom: 10                        # Default: 10 (1-15)

# Entity tracking (optional)
entity: person.john_doe         # Track a person or device

# Animation settings
show_animation: true            # Default: true
animation_speed: 500            # Default: 500ms per frame

# Display options
show_controls: true             # Default: true
show_timestamp: true            # Default: true

# Add-on configuration
addon_slug: willyweather_radar  # Default: willyweather_radar
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `latitude` | number | -33.8688 | Center latitude of the map |
| `longitude` | number | 151.2093 | Center longitude of the map |
| `zoom` | number | 10 | Map zoom level (1-15) |
| `entity` | string | - | Entity ID to track (person, device_tracker, etc.) |
| `show_animation` | boolean | true | Enable radar animation |
| `animation_speed` | number | 500 | Milliseconds between animation frames |
| `show_controls` | boolean | true | Show playback controls |
| `show_timestamp` | boolean | true | Show current frame timestamp |
| `addon_slug` | string | willyweather_radar | Slug of the WillyWeather addon |

## Examples

### Track a Person

Display radar centered on a person's location:

```yaml
type: custom:willyweather-radar-card
entity: person.john_doe
zoom: 12
show_animation: true
```

### Static Location with Custom Zoom

Show radar for a specific location:

```yaml
type: custom:willyweather-radar-card
latitude: -27.4698
longitude: 153.0251
zoom: 11
show_animation: true
animation_speed: 300
```

### Multiple Cards for Different Locations

```yaml
type: vertical-stack
cards:
  - type: custom:willyweather-radar-card
    latitude: -33.8688
    longitude: 151.2093
    zoom: 10
    title: Sydney Radar
    
  - type: custom:willyweather-radar-card
    latitude: -37.8136
    longitude: 144.9631
    zoom: 10
    title: Melbourne Radar
```

## How It Works

### Map Display

The card uses Leaflet.js to render an interactive map with OpenStreetMap tiles. Radar imagery is overlaid on top using the add-on's API.

### Radar Selection

Based on the zoom level:
- **Wide view** (> 1500km): Uses national radar covering all of Australia
- **Regional view** (< 1500km): Uses and blends multiple regional radars for seamless coverage

### Animation

The card fetches available radar timestamps and displays them in sequence:
1. Retrieves list of available timestamps from the add-on
2. Loads radar image for each timestamp
3. Cycles through frames at the configured speed
4. Loops back to the start when reaching the end

### Entity Tracking

When an entity is configured, the card:
1. Monitors the entity's state for location changes
2. Updates the map center when location changes
3. Refreshes radar data for the new location

## Troubleshooting

### Card Not Appearing

1. Verify the add-on is installed and running
2. Check browser console (F12) for errors
3. Clear browser cache and refresh
4. Verify resource is added to Lovelace

### No Radar Data

1. Check add-on logs: **Settings** → **Add-ons** → **WillyWeather Radar** → **Log**
2. Verify API key is configured in add-on
3. Ensure coordinates are within Australia
4. Check internet connectivity

### Animation Not Working

1. Verify `show_animation: true` is set
2. Check that multiple radar frames are available
3. Try refreshing the card
4. Check add-on status

### Slow Performance

1. Reduce `animation_speed` for slower frame changes
2. Increase cache duration in add-on settings
3. Reduce zoom level for smaller images
4. Check network speed

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/yourusername/willyweather-radar-card.git
cd willyweather-radar-card

# Install dependencies
npm install

# Build
npm run build

# Development (watch mode)
npm run dev
```

The built file will be in `dist/willyweather-radar-card.js`.

### Testing Locally

1. Copy `dist/willyweather-radar-card.js` to `<config>/www/`
2. Add as a resource in Lovelace
3. Add card to a dashboard
4. Check browser console for any errors

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/willyweather-radar-card/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/willyweather-radar-card/discussions)
- **Home Assistant Community**: [Forum Thread](https://community.home-assistant.io/)

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

## License

MIT License - See [LICENSE](LICENSE) file for details

## Credits

- Weather data provided by [WillyWeather](https://www.willyweather.com.au/)
- Map tiles from [OpenStreetMap](https://www.openstreetmap.org/)
- Built with [Leaflet.js](https://leafletjs.com/)
- Developed for the [Home Assistant](https://www.home-assistant.io/) community

## Related Projects

- [WillyWeather Radar Add-on](https://github.com/yourusername/willyweather-radar-addon) - Required backend add-on

---

⭐ If you find this card useful, please star the repository!
