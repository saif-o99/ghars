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

    /// The same rectangle, give or take rounding to physical pixels and back.
    fn matches(&self, o: &Bounds) -> bool {
        (self.x - o.x).abs() <= 2.0
            && (self.y - o.y).abs() <= 2.0
            && (self.w - o.w).abs() <= 2.0
            && (self.h - o.h).abs() <= 2.0
    }
}

/// How far the menu bar and the Dock reach into a display, in points.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Insets {
    pub top: f64,
    pub left: f64,
    pub right: f64,
    pub bottom: f64,
}

/// An NSScreen: its frame and visible frame in AppKit coordinates (origin at the bottom-left
/// of the main screen, y up), and whether it shows a menu bar.
pub struct Screen {
    pub frame: Bounds,
    pub visible: Bounds,
    pub has_menu_bar: bool,
}

/// The menu bar and Dock insets of the screen whose frame is `display`, given in the top-left,
/// y-down coordinates CoreGraphics and tauri use. `screens[0]` is the main screen. A menu bar
/// set to hide itself leaves no inset but still slides down over the top of the screen when the
/// pointer gets there, so `menu_bar` points are kept clear for it anyway.
pub fn insets(display: &Bounds, screens: &[Screen], menu_bar: f64) -> Option<Insets> {
    let main_height = screens.first()?.frame.h;
    screens.iter().find_map(|s| {
        let (f, v) = (s.frame, s.visible);
        let flipped = Bounds {
            y: main_height - (f.y + f.h),
            ..f
        };
        if !flipped.matches(display) {
            return None;
        }
        let mut top = (f.y + f.h) - (v.y + v.h);
        if s.has_menu_bar && top < 1.0 {
            top = menu_bar;
        }
        Some(Insets {
            top,
            left: v.x - f.x,
            right: (f.x + f.w) - (v.x + v.w),
            bottom: v.y - f.y,
        })
    })
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

    /// A 1440x900 main screen with a 25 pt menu bar and a 70 pt Dock at the bottom, and a
    /// 1920x1080 screen to its right, its top 100 pt above the main screen's, Dock-free.
    fn screens() -> Vec<Screen> {
        vec![
            Screen {
                frame: b(0.0, 0.0, 1440.0, 900.0),
                visible: b(0.0, 70.0, 1440.0, 805.0),
                has_menu_bar: true,
            },
            Screen {
                frame: b(1440.0, -80.0, 1920.0, 1080.0),
                visible: b(1440.0, -80.0, 1920.0, 1055.0),
                has_menu_bar: true,
            },
        ]
    }

    #[test]
    fn insets_of_the_main_screen() {
        let i = insets(&b(0.0, 0.0, 1440.0, 900.0), &screens(), 24.0).unwrap();
        assert_eq!(
            i,
            Insets {
                top: 25.0,
                left: 0.0,
                right: 0.0,
                bottom: 70.0
            }
        );
    }

    #[test]
    fn insets_of_a_screen_beside_it() {
        // AppKit's y = -80 with height 1080 puts its top at 1000, 100 pt above the main
        // screen's top (900): -100 in top-left coordinates.
        let i = insets(&b(1440.0, -100.0, 1920.0, 1080.0), &screens(), 24.0).unwrap();
        assert_eq!(i.top, 25.0);
        assert_eq!(i.bottom, 0.0);
    }

    #[test]
    fn a_hidden_menu_bar_still_keeps_its_strip_clear() {
        let mut s = screens();
        s[0].visible = b(0.0, 70.0, 1440.0, 830.0);
        assert_eq!(insets(&b(0.0, 0.0, 1440.0, 900.0), &s, 24.0).unwrap().top, 24.0);
        s[0].has_menu_bar = false;
        assert_eq!(insets(&b(0.0, 0.0, 1440.0, 900.0), &s, 24.0).unwrap().top, 0.0);
    }

    #[test]
    fn dock_on_the_left() {
        let mut s = screens();
        s[0].visible = b(64.0, 0.0, 1376.0, 875.0);
        let i = insets(&b(0.0, 0.0, 1440.0, 900.0), &s, 24.0).unwrap();
        assert_eq!((i.left, i.right, i.bottom), (64.0, 0.0, 0.0));
    }

    #[test]
    fn rounding_still_matches_but_another_display_does_not() {
        assert!(insets(&b(0.5, 0.0, 1439.5, 900.5), &screens(), 24.0).is_some());
        assert!(insets(&b(0.0, 0.0, 1280.0, 800.0), &screens(), 24.0).is_none());
        assert!(insets(&b(0.0, 0.0, 1440.0, 900.0), &[], 24.0).is_none());
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
