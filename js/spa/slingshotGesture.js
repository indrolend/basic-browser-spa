// Slingshot gesture — unified pointer-event pull interaction
// Works identically on touch and mouse: pointerdown → pointermove → pointerup.
// API: initSlingshot(element, callbacks) → { destroy }
// callbacks: { onArm, onLock, onPull, onRelease, onCancel }

const LOCK_THRESHOLD_PX = 15;  // minimum drag before direction is committed
const MAX_PULL_DISTANCE = 120; // px at which pullNormalized reaches 1.0

export function initSlingshot(element, callbacks = {}) {
  const { onArm, onLock, onPull, onRelease, onCancel, onTap } = callbacks;

  let phase = 'idle'; // idle | armed | locked
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lockedDirection = null;
  let lastPullVector = { x: 0, y: 0 };
  let lastPullNormalized = 0;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function dist(dx, dy) {
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Move/up/cancel listeners are added to window (not element) so that events
  // are received even when setPointerCapture fails or the pointer leaves the
  // element boundary before the LOCK_THRESHOLD_PX is crossed.
  function addWindowListeners() {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  }

  function removeWindowListeners() {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
  }

  function handlePointerDown(e) {
    if (phase !== 'idle') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    phase = 'armed';
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    lastPullVector = { x: 0, y: 0 };
    lastPullNormalized = 0;
    lockedDirection = null;

    // setPointerCapture routes captured events back to this element so they
    // continue to bubble up to our window listeners. If capture fails the
    // window listeners still receive all events — the fallback is seamless.
    try { element.setPointerCapture(e.pointerId); } catch (_e) { /* intentionally ignored */ }
    element.style.touchAction = 'none';
    addWindowListeners();

    if (typeof onArm === 'function') onArm();
  }

  function handlePointerMove(e) {
    if (e.pointerId !== pointerId) return;
    if (phase !== 'armed' && phase !== 'locked') return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const d = dist(dx, dy);

    if (phase === 'armed') {
      if (d < LOCK_THRESHOLD_PX) return;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      lockedDirection = adx >= ady ? (dx < 0 ? 'next' : 'prev') : (dy < 0 ? 'next' : 'prev');
      phase = 'locked';
      lastPullVector = { x: dx, y: dy };
      lastPullNormalized = clamp(d / MAX_PULL_DISTANCE, 0, 1);
      if (typeof onLock === 'function') {
        onLock({ direction: lockedDirection, pullVector: lastPullVector, pullNormalized: lastPullNormalized });
      }
      return;
    }

    // phase === 'locked'
    lastPullVector = { x: dx, y: dy };
    lastPullNormalized = clamp(d / MAX_PULL_DISTANCE, 0, 1);
    if (typeof onPull === 'function') {
      onPull({ pullVector: lastPullVector, pullNormalized: lastPullNormalized });
    }
  }

  function finalize(e, isCancelled) {
    if (e && e.pointerId !== pointerId) return;
    if (phase === 'idle') return;

    removeWindowListeners();
    element.style.touchAction = '';
    const wasLocked = phase === 'locked';
    const savedDirection = lockedDirection;
    const savedPullVector = { ...lastPullVector };
    const savedPullNormalized = lastPullNormalized;

    phase = 'idle';
    pointerId = null;
    lockedDirection = null;

    if (isCancelled || !wasLocked) {
      if (isCancelled) {
        if (typeof onCancel === 'function') onCancel();
      } else {
        // Pointer released without reaching the drag threshold — treat as a tap.
        if (typeof onTap === 'function') onTap();
        else if (typeof onCancel === 'function') onCancel();
      }
      return;
    }

    if (typeof onRelease === 'function') {
      onRelease({ direction: savedDirection, pullVector: savedPullVector, pullNormalized: savedPullNormalized });
    }
  }

  function handlePointerUp(e) { finalize(e, false); }
  function handlePointerCancel(e) { finalize(e, true); }

  element.addEventListener('pointerdown', handlePointerDown);
  // pointermove / pointerup / pointercancel are registered on window dynamically
  // inside handlePointerDown and cleaned up inside finalize().

  return {
    destroy() {
      element.removeEventListener('pointerdown', handlePointerDown);
      // Cancel any in-progress gesture so callbacks and touchAction are cleaned up.
      if (phase !== 'idle') finalize(null, true);
      // Guard: remove window listeners in case finalize was already called.
      removeWindowListeners();
      element.style.touchAction = '';
      phase = 'idle';
      pointerId = null;
    }
  };
}
