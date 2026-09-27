"""Drowsiness thresholds and alarm state.

Scores run from 0 to 100. These are application thresholds chosen for this
project, not medically validated values. Edit them here to tune the app.

The alarm sound itself plays in the browser (AlertBox.jsx) whenever a
detection result has "alert": true. This module decides when that is.
"""

import threading

AWAKE_MAX = 30     # 0-30   -> awake
WARNING_MAX = 60   # 31-60  -> warning
                   # 61-100 -> drowsy

# The alarm starts when the status becomes drowsy and keeps sounding until the
# score falls to ALARM_OFF_SCORE or below, so it doesn't flicker on and off
# while the score hovers around the drowsy threshold.
ALARM_OFF_SCORE = 40

_alarms = {}   # user key -> True while that user's alarm is sounding
_lock = threading.Lock()


def get_status(score):
    if score <= AWAKE_MAX:
        return "awake"
    if score <= WARNING_MAX:
        return "warning"
    return "drowsy"


def update_alarm(key, score):
    """Update and return whether the alarm is active for this user."""
    with _lock:
        active = _alarms.get(key, False)
        if score > WARNING_MAX:
            active = True
        elif score <= ALARM_OFF_SCORE:
            active = False
        _alarms[key] = active
        return active


def is_alarm_active(key):
    with _lock:
        return _alarms.get(key, False)


def reset(key):
    with _lock:
        _alarms.pop(key, None)
