"""Drowsiness thresholds and alert state.

Scores run from 0 to 100. These are application thresholds chosen for this
project, not medically validated values. Edit them here to tune the app.
"""

AWAKE_MAX = 30     # 0-30   -> awake
WARNING_MAX = 60   # 31-60  -> warning
                   # 61-100 -> drowsy


def get_status(score):
    if score <= AWAKE_MAX:
        return "awake"
    if score <= WARNING_MAX:
        return "warning"
    return "drowsy"


def is_alert(status):
    return status == "drowsy"
