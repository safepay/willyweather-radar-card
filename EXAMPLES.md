# Example Lovelace Card Configurations

## Basic Example

```yaml
type: custom:willyweather-radar-card
latitude: -33.8688
longitude: 151.2093
zoom: 10
```

## Track a Person

```yaml
type: custom:willyweather-radar-card
entity: person.john_doe
zoom: 12
show_animation: true
animation_speed: 500
```

## Multiple Locations

```yaml
type: vertical-stack
cards:
  # Sydney
  - type: custom:willyweather-radar-card
    latitude: -33.8688
    longitude: 151.2093
    zoom: 10
    show_animation: true
    
  # Melbourne  
  - type: custom:willyweather-radar-card
    latitude: -37.8136
    longitude: 144.9631
    zoom: 10
    show_animation: true
    
  # Brisbane
  - type: custom:willyweather-radar-card
    latitude: -27.4698
    longitude: 153.0251
    zoom: 10
    show_animation: true
```

## Grid Layout

```yaml
type: grid
columns: 2
cards:
  - type: custom:willyweather-radar-card
    latitude: -33.8688
    longitude: 151.2093
    zoom: 9
    title: Sydney
    
  - type: custom:willyweather-radar-card
    latitude: -37.8136
    longitude: 144.9631
    zoom: 9
    title: Melbourne
```

## With Device Tracker

```yaml
type: custom:willyweather-radar-card
entity: device_tracker.phone
zoom: 11
show_animation: true
animation_speed: 300
show_timestamp: true
```

## Minimal (No Controls)

```yaml
type: custom:willyweather-radar-card
latitude: -27.4698
longitude: 153.0251
zoom: 10
show_animation: false
show_controls: false
show_timestamp: false
```

## Fast Animation

```yaml
type: custom:willyweather-radar-card
latitude: -34.9285
longitude: 138.6007
zoom: 10
show_animation: true
animation_speed: 200  # Fast playback
```

## Conditional Card (Show only when raining)

```yaml
type: conditional
conditions:
  - entity: sensor.rain_today
    state_not: "0"
card:
  type: custom:willyweather-radar-card
  entity: zone.home
  zoom: 11
```

## In a Picture Elements Card

```yaml
type: picture-elements
image: /local/background.jpg
elements:
  - type: custom:willyweather-radar-card
    style:
      top: 50%
      left: 50%
      width: 80%
      transform: translate(-50%, -50%)
    latitude: -33.8688
    longitude: 151.2093
    zoom: 10
```

## Tab View

```yaml
type: vertical-stack
cards:
  - type: markdown
    content: |
      ## Weather Radar
      Real-time radar imagery for Australia
      
  - type: custom:willyweather-radar-card
    entity: zone.home
    zoom: 10
    show_animation: true
```

## With Markdown Description

```yaml
type: vertical-stack
cards:
  - type: markdown
    content: "## Current Radar - {{ states('sensor.my_location') }}"
    
  - type: custom:willyweather-radar-card
    latitude: -33.8688
    longitude: 151.2093
    zoom: 10
```

## Major Australian Cities

### Sydney
```yaml
type: custom:willyweather-radar-card
latitude: -33.8688
longitude: 151.2093
zoom: 10
```

### Melbourne
```yaml
type: custom:willyweather-radar-card
latitude: -37.8136
longitude: 144.9631
zoom: 10
```

### Brisbane
```yaml
type: custom:willyweather-radar-card
latitude: -27.4698
longitude: 153.0251
zoom: 10
```

### Perth
```yaml
type: custom:willyweather-radar-card
latitude: -31.9505
longitude: 115.8605
zoom: 10
```

### Adelaide
```yaml
type: custom:willyweather-radar-card
latitude: -34.9285
longitude: 138.6007
zoom: 10
```

### Canberra
```yaml
type: custom:willyweather-radar-card
latitude: -35.2809
longitude: 149.1300
zoom: 10
```

### Hobart
```yaml
type: custom:willyweather-radar-card
latitude: -42.8821
longitude: 147.3272
zoom: 10
```

### Darwin
```yaml
type: custom:willyweather-radar-card
latitude: -12.4634
longitude: 130.8456
zoom: 10
```
