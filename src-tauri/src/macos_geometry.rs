//! macOS display geometry, kept free of AppKit so it can be tested on any platform.

// Elsewhere only the tests use it.
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

/// A rectangle in points.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Bounds {
    pub fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x < self.x + self.w && y >= self.y && y < self.y + self.h
    }

    fn overlaps(&self, o: &Bounds) -> bool {
        self.x < o.x + o.w && o.x < self.x + self.w && self.y < o.y + o.h && o.y < self.y + self.h
    }

    /// Covers all of `o`, give or take a point of rounding.
    fn covers(&self, o: &Bounds) -> bool {
        self.x <= o.x + 1.0
            && self.y <= o.y + 1.0
            && self.x + self.w >= o.x + o.w - 1.0
            && self.y + self.h >= o.y + o.h - 1.0
    }
}

/// A window on screen, as CGWindowListCopyWindowInfo reports it (front to back), in points
/// from the top-left of the main display.
#[derive(Debug)]
pub struct WindowInfo {
    pub pid: i64,
    pub layer: i64,
    pub alpha: f64,
    pub bounds: Bounds,
    pub owner: String,
}

/// The full-screen window in front on `display`, if there is one. The app in front there owns
/// the frontmost ordinary window (layer 0, visible, not tiny, not Ghars's own) overlapping the
/// display; it is full screen if one of its windows covers the whole display. Not just its
/// frontmost window: full-screen apps can keep a toolbar or tab bar window in front of it.
pub fn full_screen_window<'a>(display: &Bounds, windows: &'a [WindowInfo], own_pid: i64) -> Option<&'a WindowInfo> {
    let front = windows.iter().find(|w| {
        w.layer == 0
            && w.pid != own_pid
            && w.alpha > 0.0
            && w.bounds.w >= 50.0
            && w.bounds.h >= 50.0
            && w.bounds.overlaps(display)
    })?;
    windows
        .iter()
        .find(|w| w.pid == front.pid && w.layer >= 0 && w.alpha > 0.0 && w.bounds.covers(display))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn b(x: f64, y: f64, w: f64, h: f64) -> Bounds {
        Bounds { x, y, w, h }
    }

    fn win(pid: i64, layer: i64, bounds: Bounds) -> WindowInfo {
        WindowInfo {
            pid,
            layer,
            alpha: 1.0,
            bounds,
            owner: format!("app {pid}"),
        }
    }

    const DISPLAY: Bounds = Bounds {
        x: 0.0,
        y: 0.0,
        w: 1440.0,
        h: 900.0,
    };

    #[test]
    fn full_screen_app_in_front() {
        let windows = [
            win(7, 25, b(0.0, 0.0, 1440.0, 24.0)),
            win(42, 0, DISPLAY),
            win(9, 0, b(100.0, 100.0, 800.0, 600.0)),
        ];
        assert_eq!(full_screen_window(&DISPLAY, &windows, 1).map(|w| w.pid), Some(42));
    }

    #[test]
    fn a_toolbar_window_in_front_of_the_full_screen_one() {
        let windows = [win(42, 0, b(0.0, 0.0, 1440.0, 52.0)), win(42, 0, DISPLAY)];
        assert_eq!(full_screen_window(&DISPLAY, &windows, 1).map(|w| w.pid), Some(42));
    }

    #[test]
    fn a_zoomed_window_is_not_full_screen() {
        let windows = [win(42, 0, b(0.0, 25.0, 1440.0, 805.0))];
        assert!(full_screen_window(&DISPLAY, &windows, 1).is_none());
    }

    #[test]
    fn only_the_app_in_front_counts() {
        // A full-screen-sized window behind the app in front doesn't count, nor does Ghars's own.
        let windows = [
            win(1, 0, DISPLAY),
            win(9, 0, b(100.0, 100.0, 800.0, 600.0)),
            win(42, 0, DISPLAY),
        ];
        assert!(full_screen_window(&DISPLAY, &windows, 1).is_none());
    }

    #[test]
    fn a_full_screen_app_on_another_display() {
        let other = b(1440.0, 0.0, 1920.0, 1080.0);
        let windows = [win(42, 0, other), win(9, 0, b(100.0, 100.0, 800.0, 600.0))];
        assert!(full_screen_window(&DISPLAY, &windows, 1).is_none());
        assert_eq!(full_screen_window(&other, &windows, 1).map(|w| w.pid), Some(42));
    }

    #[test]
    fn invisible_and_tiny_windows_are_skipped() {
        let mut invisible = win(9, 0, b(0.0, 0.0, 800.0, 600.0));
        invisible.alpha = 0.0;
        let windows = [invisible, win(8, 0, b(0.0, 0.0, 10.0, 10.0)), win(42, 0, DISPLAY)];
        assert_eq!(full_screen_window(&DISPLAY, &windows, 1).map(|w| w.pid), Some(42));
    }
}
