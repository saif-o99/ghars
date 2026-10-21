#!/usr/bin/env swift
// Plays a guided tour of Ghars on macOS, for recording the demo video.
//
//   swift ghars-demo.swift            run the whole tour
//   swift ghars-demo.swift --slow     the same at half speed, to check each step
//   swift ghars-demo.swift --only 4   run one scene (see SCENES at the bottom)
//   swift ghars-demo.swift --list     print every control Ghars shows to macOS, then exit
//
// It finds buttons by their accessible names (the same names VoiceOver reads), so it doesn't
// depend on screen size or where windows are. Terminal needs Accessibility permission:
// System Settings → Privacy & Security → Accessibility.
// Before running: Ghars open, English interface, Graphite theme, Notch style, top edge,
// prayer times turned on. See CHATGPT-PROMPT.md next to this file.

import AppKit
import ApplicationServices

let args = CommandLine.arguments
let speed = args.contains("--slow") ? 2.0 : 1.0
let only: Int? = args.firstIndex(of: "--only").flatMap { $0 + 1 < args.count ? Int(args[$0 + 1]) : nil }
/// Pixels per scroll event. Ghars counts once per 50 px of scrolling, so each event is one count.
let pixelsPerCount: Int32 = 60
let api = "http://127.0.0.1:47821"

func log(_ s: String) {
    print(s)
    fflush(stdout)
}

func wait(_ seconds: Double) {
    Thread.sleep(forTimeInterval: seconds * speed)
}

// MARK: - Finding Ghars's controls

guard let ghars = NSRunningApplication.runningApplications(withBundleIdentifier: "com.ghars.desktop").first else {
    log("Ghars isn't running. Open it first.")
    exit(1)
}
let axApp = AXUIElementCreateApplication(ghars.processIdentifier)

let trustPrompt = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
guard AXIsProcessTrustedWithOptions(trustPrompt) else {
    log("Terminal needs Accessibility permission: System Settings → Privacy & Security → Accessibility.")
    log("Turn it on for Terminal, then run this again.")
    exit(1)
}

struct Node {
    let el: AXUIElement
    let role: String
    let subrole: String
    let name: String
    let frame: CGRect
    /// Names of the enclosing elements, nearest last (for example a radio group's label).
    let ancestors: [String]
}

func attr<T>(_ el: AXUIElement, _ name: String) -> T? {
    var v: CFTypeRef?
    guard AXUIElementCopyAttributeValue(el, name as CFString, &v) == .success else { return nil }
    return v as? T
}

func frameOf(_ el: AXUIElement) -> CGRect? {
    var p: CFTypeRef?
    var s: CFTypeRef?
    guard AXUIElementCopyAttributeValue(el, kAXPositionAttribute as CFString, &p) == .success,
        AXUIElementCopyAttributeValue(el, kAXSizeAttribute as CFString, &s) == .success,
        let p, let s
    else { return nil }
    var point = CGPoint.zero
    var size = CGSize.zero
    AXValueGetValue(p as! AXValue, .cgPoint, &point)
    AXValueGetValue(s as! AXValue, .cgSize, &size)
    return CGRect(origin: point, size: size)
}

func walk(_ el: AXUIElement, _ ancestors: [String], _ depth: Int, _ out: inout [Node]) {
    if depth > 80 { return }
    let role: String = attr(el, kAXRoleAttribute) ?? ""
    if role == "AXMenuBar" { return }
    let subrole: String = attr(el, kAXSubroleAttribute) ?? ""
    let title: String = attr(el, kAXTitleAttribute) ?? ""
    let desc: String = attr(el, kAXDescriptionAttribute) ?? ""
    let value: String = attr(el, kAXValueAttribute) ?? ""
    let name = [title, desc, value].first { !$0.isEmpty } ?? ""
    if let f = frameOf(el), f.width > 1, f.height > 1 {
        out.append(Node(el: el, role: role, subrole: subrole, name: name, frame: f, ancestors: ancestors))
    }
    let kids: [AXUIElement] = attr(el, kAXChildrenAttribute) ?? []
    for k in kids { walk(k, name.isEmpty ? ancestors : ancestors + [name], depth + 1, &out) }
}

func snapshot() -> [Node] {
    var out: [Node] = []
    walk(axApp, [], 0, &out)
    return out
}

let clickableRoles: Set<String> = [
    "AXButton", "AXRadioButton", "AXCheckBox", "AXPopUpButton", "AXMenuButton", "AXComboBox",
    "AXMenuItem", "AXLink", "AXTab", "AXTextField",
]

/// Waits up to 3 s for a control whose name matches. Prefers buttons and the like; `anyRole`
/// also accepts text and groups. Logs and returns nil if it never shows up.
func find(
    _ label: String, within: String? = nil, anyRole: Bool = false, largest: Bool = false,
    matching: ((String) -> Bool)? = nil
) -> Node? {
    let matches = matching ?? { $0 == label }
    for _ in 0..<10 {
        let all = snapshot().filter { matches($0.name) && (within == nil || $0.ancestors.contains(within!)) }
        let buttons = all.filter { clickableRoles.contains($0.role) }
        let candidates = buttons.isEmpty && anyRole ? all : buttons
        let pick =
            largest
            ? candidates.max { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }
            : candidates.first
        if let pick { return pick }
        Thread.sleep(forTimeInterval: 0.3)
    }
    log("   ⚠️  NOT FOUND: \"\(label)\"" + (within.map { " inside \"\($0)\"" } ?? ""))
    return nil
}

/// The island's own outline: the "Ghars" region nearest the top of the screen.
func island() -> CGRect? {
    let regions = snapshot().filter { $0.name == "Ghars" && !clickableRoles.contains($0.role) && $0.role != "AXWindow" }
    return regions.min { $0.frame.minY < $1.frame.minY }?.frame
}

// MARK: - Mouse and keyboard

let screen = CGDisplayBounds(CGMainDisplayID())

func cursor() -> CGPoint {
    CGEvent(source: nil)?.location ?? .zero
}

/// Glides the pointer to `p` with an ease-in-out curve, like a person would.
func move(to p: CGPoint, duration: Double = 0.7) {
    let a = cursor()
    let steps = max(1, Int(duration * speed * 60))
    for i in 1...steps {
        let t = Double(i) / Double(steps)
        let e = t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2
        let q = CGPoint(x: a.x + (p.x - a.x) * e, y: a.y + (p.y - a.y) * e)
        CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: q, mouseButton: .left)?
            .post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 1.0 / 60)
    }
}

func click() {
    let p = cursor()
    for type in [CGEventType.leftMouseDown, .leftMouseUp] {
        CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left)?
            .post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.07)
    }
}

func center(_ r: CGRect) -> CGPoint {
    CGPoint(x: r.midX, y: r.midY)
}

/// Moves to a control, clicks it, then pauses so the viewer sees what changed.
func clickOn(_ label: String, within: String? = nil, anyRole: Bool = false, pause: Double = 0.8) {
    log("   click \"\(label)\"")
    guard let n = find(label, within: within, anyRole: anyRole) else { return }
    move(to: center(n.frame))
    wait(0.15)
    click()
    wait(pause)
}

/// Scrolls `counts` notches, one count each, at a calm pace.
func scroll(_ counts: Int, every interval: Double = 0.4) {
    for _ in 0..<counts {
        CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: -pixelsPerCount, wheel2: 0, wheel3: 0)?
            .post(tap: .cghidEventTap)
        wait(interval)
    }
}

func key(_ code: CGKeyCode, _ flags: CGEventFlags = []) {
    for down in [true, false] {
        let e = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)
        e?.flags = flags
        e?.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.05)
    }
}

let keyG: CGKeyCode = 5
let keyEscape: CGKeyCode = 53

/// Tells Ghars an AI agent started or stopped, exactly as a connected agent's hook does.
func agent(_ kind: String) {
    var req = URLRequest(url: URL(string: "\(api)/v1/\(kind)")!)
    req.httpMethod = "POST"
    let done = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: req) { _, _, _ in done.signal() }.resume()
    _ = done.wait(timeout: .now() + 3)
}

/// A resting spot well below the island, so it closes.
func away() -> CGPoint {
    CGPoint(x: screen.midX + 140, y: screen.minY + screen.height * 0.55)
}

/// Moves onto the top of the island so it opens.
func hoverIsland() {
    guard let r = island() else {
        log("   ⚠️  NOT FOUND: the island")
        return
    }
    move(to: CGPoint(x: r.midX, y: r.minY + 14), duration: 0.9)
    wait(1.3)
}

/// The wheel: the largest control named "Count".
func overWheel() {
    if let w = find("Count", largest: true) { move(to: center(w.frame), duration: 0.5) }
    wait(0.3)
}

// MARK: - Scenes

let packNames = ["General adhkar", "Morning adhkar", "Evening adhkar", "After prayer", "Friday"]

let SCENES: [(String, () -> Void)] = [
    ("Open the island and count istighfar", {
        move(to: away(), duration: 0.4)
        wait(1)
        hoverIsland()
        overWheel()
        scroll(7)
        wait(0.6)
    }),
    ("Adhkar: next dhikr, then the morning set", {
        clickOn("Adhkar")
        overWheel()
        scroll(3)
        clickOn("Next")
        clickOn("Next")
        log("   click the set menu")
        if let chip = find("set menu", matching: { name in packNames.contains { name.hasPrefix($0) } }) {
            move(to: center(chip.frame))
            wait(0.15)
            click()
            wait(0.8)
        }
        clickOn("Morning adhkar", anyRole: true, pause: 1.2)
        overWheel()
        scroll(3)
    }),
    ("Close, then open with the shortcut", {
        move(to: away(), duration: 0.8)
        wait(1.4)
        log("   press ⌘⌥G")
        key(keyG, [.maskCommand, .maskAlternate])
        wait(2)
        log("   press Esc")
        key(keyEscape)
        wait(1.2)
    }),
    ("An AI agent starts working", {
        log("   agent busy")
        agent("busy")
        wait(3)
        hoverIsland()
        overWheel()
        scroll(3)
        agent("idle")
        move(to: away(), duration: 0.8)
        wait(1.4)
    }),
    ("Settings: themes, style and screen edge", {
        hoverIsland()
        clickOn("Settings", pause: 1.8)
        for theme in ["Classic Fes", "Iznik Tile", "Lantern Night", "Marrakech Red", "Graphite"] {
            clickOn(theme, pause: 1.1)
        }
        clickOn("Floating", within: "Island style", pause: 1.4)
        clickOn("Left", within: "Screen edge", pause: 1.8)
        clickOn("Top", within: "Screen edge", pause: 1.4)
        clickOn("Notch", within: "Island style", pause: 1.4)
    }),
    ("Prayer times and stats", {
        clickOn("Prayer times", pause: 2.2)
        clickOn("Stats", pause: 2.2)
    }),
    ("Arabic, then back to English", {
        clickOn("Language", anyRole: true, pause: 0.8)
        clickOn("العربية", anyRole: true, pause: 2.8)
        clickOn("اللغة", anyRole: true, pause: 0.8)
        clickOn("English", anyRole: true, pause: 1.2)
    }),
    ("Close Settings", {
        clickOn("Appearance", pause: 0.8)
        log("   close the Settings window")
        if let close = snapshot().first(where: { $0.subrole == "AXCloseButton" }) {
            move(to: center(close.frame))
            wait(0.2)
            click()
        } else {
            log("   ⚠️  NOT FOUND: the Settings window's close button")
        }
        wait(0.6)
        move(to: away(), duration: 0.9)
        wait(2)
    }),
]

// MARK: - Run

if args.contains("--list") {
    for n in snapshot() where !n.name.isEmpty {
        let r = n.frame
        log("\(n.role)\(n.subrole.isEmpty ? "" : "/\(n.subrole)")  \"\(n.name)\"  at \(Int(r.minX)),\(Int(r.minY)) \(Int(r.width))×\(Int(r.height))  in: \(n.ancestors.suffix(2).joined(separator: " › "))")
    }
    exit(0)
}

for i in stride(from: 3, through: 1, by: -1) {
    log("Starting in \(i)… (start recording now, then don't touch the mouse or keyboard)")
    Thread.sleep(forTimeInterval: 1)
}
// Hide Terminal so it isn't in the video; it comes back at the end.
let terminal = NSWorkspace.shared.frontmostApplication
if terminal?.processIdentifier != ghars.processIdentifier { terminal?.hide() }
wait(0.8)

for (i, scene) in SCENES.enumerated() where only == nil || only == i + 1 {
    log("Scene \(i + 1): \(scene.0)")
    scene.1()
}

terminal?.unhide()
terminal?.activate()
log("Done. Stop the recording.")
