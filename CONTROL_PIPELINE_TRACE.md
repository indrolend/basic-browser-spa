# Music Orb Control Pipeline Trace

## Complete Event Flow

### 1. Overlay Lifecycle
```
User clicks "Music" button
  ↓
openMusicPlayer() called
  ↓
window.__SPA_Overlay.open('musicPlayer') → new canvas DOM element created
  ↓
MutationObserver detects new #music-orb element
  ↓
initOrbHero3D(canvas, manager) called → event listeners attached
  ↓
if !musicEnabled: toggleEnabled() → playback starts
else: play() → playback starts
```

### 2. Click/Drag Interaction Flow (Happy Path)
```
User clicks and/or drags on canvas
  ↓
onPointerDown(e)
  ├─ Set dragging = true
  ├─ Save dragStartX/Y, pointerId
  ├─ Call manager.unlock() → audio context resumed
  ├─ canvas.setPointerCapture(pointerId) → browser captures all pointer events
  └─ Reset gesture state (pullDx, pullDy, pullArmed, volumeArmed)
  ↓
onPointerMove(e) [repeats many times]
  ├─ Calculate dx, dy from drag start
  ├─ Update pointerX, pointerY for mesh interaction
  ├─ Determine gesture dominance:
  │   ├─ Horizontal > vertical * 1.35 → pullArmed = true (track switch)
  │   └─ Vertical > horizontal * 1.35 → volumeArmed = true (volume)
  └─ If volumeArmed: setUserVolume(newVolume)
  ↓
onPointerUp(e) [triggers gesture action]
  ├─ Set dragging = false
  ├─ Try to release pointer capture
  ├─ Determine action based on gesture:
  │   ├─ If pullArmed && dx > 72px:
  │   │   ├─ dx > 0 → nextTrack()
  │   │   └─ dx < 0 → prevTrack()
  │   └─ Else if total move < 10px → toggleEnabled() (tap)
  └─ Reset all gesture state
```

### 3. Bad Path: Sticking Controls (FIXED)
```
User clicks and drags on canvas
  ↓
[Same as above until...]
  ↓
User closes overlay WHILE DRAGGING
  ↓
Canvas removed from DOM before pointerup fires
  ↓
[BEFORE FIX]
  ├─ destroy() called, event listeners removed
  ├─ BUT: dragging still = true in old closure
  ├─ Pointer capture still held by detached canvas
  ├─ Browser's pointer tracking is now stale
  ↓
  User opens overlay again
  ├─ New canvas element created
  ├─ initOrbHero3D() called with fresh closure
  ├─ BUT: Browser's pointer capture is confused
  └─ Pointer events don't work reliably on new canvas
  
[AFTER FIX]
  ├─ forceCleanup() called in destroy()
  │   ├─ Set dragging = false (resets state)
  │   ├─ Reset pullDx, pullDy, pullArmed, volumeArmed
  │   └─ Try to release capture on old canvas if still in DOM
  ├─ onLostPointerCapture handler fires:
  │   └─ forceCleanup() called automatically
  └─ New canvas works properly
```

### 4. Pointer Capture Safety

**What can go wrong:**
- Canvas removed from DOM mid-drag
- pointerup event never fires
- Pointer capture never released
- Browser's internal pointer routing gets stuck

**Fixes applied:**
1. **onPointerDown**: Store `canvas._lastPointerId` for later cleanup
2. **onPointerUp**: Wrap releasePointerCapture in try/catch
3. **forceCleanup()**: New function that:
   - Unconditionally resets all gesture state
   - Attempts release if canvas still in DOM
   - Ignores errors from detached nodes
4. **lostpointercapture listener**: Fires when browser loses capture unexpectedly
5. **destroy()**: Calls forceCleanup() before removing listeners

## Manager Integration

The controls call these manager methods:
- `unlock()` - Resume audio context on first pointer interaction
- `play()` - Start playback
- `toggleEnabled()` - Toggle mute/unmute
- `nextTrack()` - Skip to random next track
- `prevTrack()` - Go to previous track
- `setUserVolume(v)` - Set volume (0-1)
- `getAnalyserData()` - Get frequency data for audio-reactive spikes
- `getUserVolume()` - Get current volume for drag baseline

## Gesture Recognition Thresholds

| Gesture | Threshold | Action |
|---------|-----------|--------|
| **Tap** | `< 10px` total move | `toggleEnabled()` |
| **Track Pull** | `> 72px` horizontal, `horizontalDominant` | `nextTrack()` / `prevTrack()` |
| **Volume Drag** | `> 120px` vertical, `verticalDominant` | `setUserVolume()` |
| **Dominance Gate** | `1.35x` ratio (other axis must be < 74% of dominant) | Determines gesture type |
| **Min Gesture** | `> 12px` movement | Distinguishes from tap noise |

## Canvas State Variables

These track the current gesture:
```javascript
dragging = false              // Pointer is down
dragStartX/Y = 0              // Initial pointer position
pullDx/Dy = 0                 // Absolute drag offset
pullArmed = false             // Track pull gesture locked in
volumeArmed = false           // Volume drag gesture locked in
dragStartVolume = 1           // Baseline volume for drag calculation
pointerX/Y = centerX/Y        // Current pointer position for mesh interaction
```

## Risk Areas

1. **MutationObserver timing**: If overlay closes during MutationObserver callback, callbacks could be queued
   - **Mitigation**: forceCleanup ensures state is safe

2. **Pointer events on removed nodes**: getBoundingClientRect() might fail or return wrong values
   - **Mitigation**: All DOM operations wrapped in try/catch

3. **Audio context suspension during drag**: If user drags across browser window boundary, context might suspend
   - **Mitigation**: unlock() called on every pointerdown to resume context

4. **Multiple canvases**: If overlay re-opens too quickly, old/new canvases might coexist briefly
   - **Mitigation**: orbCleanup.destroy() called before creating new instance

## Testing Checklist

- [ ] Click on orb → toggles mute
- [ ] Horizontal drag > 72px → next/prev track
- [ ] Vertical drag > 120px → volume control
- [ ] Drag while closing overlay → doesn't get stuck
- [ ] Reopen overlay after drag → controls work
- [ ] Rapid open/close cycles → no sticking
- [ ] Drag near edge of canvas → works
- [ ] Mobile touch drag → works
- [ ] Keyboard arrow keys → next/prev track
- [ ] Spacebar → toggle mute
