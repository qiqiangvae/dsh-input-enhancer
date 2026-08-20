window.__ModuleLoader__.load({
  id: 'dsh-input-enhancer',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    /* =========================================================================
     * Constants & dictionaries
     * ======================================================================= */

    var NS = 'dsh-input-enhancer'
    var STYLE_ID = 'dsh-input-enhancer-style'

    /**
     * Keyboard shortcut for the lock: Ctrl+Alt+L (Windows/Linux) or
     * Cmd+Alt+L (macOS). Enabled by default; it toggles the current session's
     * lock and only acts while the composer is focused. Deliberately NOT
     * Ctrl/Cmd+L (reserved for the browser address bar) and NOT Ctrl+Shift+L
     * (Edge reserves it for "paste and search").
     */
    var SHORTCUT_ENABLED = true

    var TRIPLE_TAP_WINDOW_MS = 800

    /** Duration of the unlock firework after the 3rd Enter tap. */
    var BURST_MS = 1000

    /**
     * Character count above which the composer is considered "long text":
     * the count badge switches to a warning state as a visual hint before
     * sending. Kept as a constant so it's easy to tune or expose later.
     */
    var LONG_TEXT_THRESHOLD = 800

    var zh = {
      lockLabel: '锁定输入框',
      unlockLabel: '解锁输入框',
      unlockedHint: '已解锁，输入框为默认大小，Enter 可正常发送',
      lockedHint: '已锁定并放大输入框，Enter 不会发送；连按 3 次 Enter 可解锁并立即发送',
      charCountHint: '已输入 {count} 个字符',
      longTextHint: '已输入 {count} 个字符，内容较长',
    }

    var en = {
      lockLabel: 'Lock composer',
      unlockLabel: 'Unlock composer',
      unlockedHint: 'Unlocked: composer is normal size, Enter sends normally',
      lockedHint: 'Locked and enlarged: Enter will not send. Press Enter 3 times to unlock and send',
      charCountHint: '{count} characters entered',
      longTextHint: '{count} characters entered — long text',
    }

    /* =========================================================================
     * Infrastructure: a tiny external store + its React binding.
     *
     * Features own independent stores; `apply()` wires them. This generic
     * primitive keeps feature code free of publish/subscribe boilerplate.
     * ======================================================================= */

    function tinyStore(initial) {
      var listeners = new Set()
      var snapshot = initial

      return {
        getSnapshot: function () { return snapshot },
        subscribe: function (listener) {
          listeners.add(listener)
          return function () { listeners.delete(listener) }
        },
        set: function (updater) {
          var next = typeof updater === 'function' ? updater(snapshot) : updater
          if (next === snapshot) return
          snapshot = next
          listeners.forEach(function (listener) { listener() })
        },
      }
    }

    function useStoreSnapshot(store) {
      var state = React.useState(store.getSnapshot())
      var snapshot = state[0]
      var setSnapshot = state[1]
      React.useEffect(function () {
        return store.subscribe(function () {
          setSnapshot(store.getSnapshot())
        })
      }, [store])
      return snapshot
    }

    /* =========================================================================
     * Shared icon components
     * ======================================================================= */

    function LockIcon(props) {
      var locked = props.locked
      var shackle = locked
        ? 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2'
        : 'M5.5 7V5a2.5 2.5 0 0 1 5 0'
      return React.createElement('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        fill: 'none',
      },
        React.createElement('path', {
          d: shackle,
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
        React.createElement('rect', {
          x: 3.5,
          y: 7,
          width: 9,
          height: 6,
          rx: 1.5,
          fill: 'currentColor',
        }))
    }

    /**
     * Firework layer shown for ~1s after the 3rd Enter tap. It is a fixed
     * overlay anchored to the lock button's center, so the particles can
     * escape the 28px button bounds (the button itself clips nothing).
     *
     * Each particle is a tiny square that flies outward along a pre-set
     * angle, falls with a slight deceleration, and fades. Colors are fixed to
     * stay dependency-free (no image/emoji assets).
     */
    var FIREWORK_COLORS = ['#ffd166', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f472b6', '#60a5fa', '#fbbf24']
    var FIREWORK_COUNT = 32

    /**
     * Mount a firework directly onto `document.body` and auto-remove it after
     * ~1s. It is plain DOM (not React) on purpose: `react-dom` is not in the
     * module table, and body-mounting escapes any transform/filter/contain on
     * the composer's ancestors that would otherwise break `position: fixed`
     * and shift the firework away from the lock button.
     *
     * @param anchor - { x, y } viewport center where the burst originates.
     */
    function mountFirework(anchor) {
      if (typeof document === 'undefined') return function () {}
      var root = document.createElement('div')
      root.setAttribute('data-dsh-firework', '')
      root.style.left = anchor.x + 'px'
      root.style.top = anchor.y + 'px'

      var core = document.createElement('span')
      core.className = 'dsh-firework-core'
      var flash = document.createElement('span')
      flash.className = 'dsh-firework-flash'
      root.appendChild(core)
      root.appendChild(flash)

      var angleStep = (Math.PI * 2) / FIREWORK_COUNT
      for (var i = 0; i < FIREWORK_COUNT; i++) {
        var angle = angleStep * i + (i % 2) * angleStep * 0.25 // slight jitter
        var dist = 56 + (i % 5) * 11 // 56 ~ 100px, varied travel
        var size = 6 + (i % 3) * 2 // 6 / 8 / 10px mix
        var p = document.createElement('span')
        p.className = 'dsh-firework-particle'
        p.style.setProperty('--dsh-fw-color', FIREWORK_COLORS[i % FIREWORK_COLORS.length])
        p.style.setProperty('--dsh-fw-dx', (Math.cos(angle) * dist) + 'px')
        p.style.setProperty('--dsh-fw-dy', (Math.sin(angle) * dist) + 'px')
        p.style.setProperty('--dsh-fw-size', size + 'px')
        root.appendChild(p)
      }

      document.body.appendChild(root)

      var removed = false
      function cleanup() {
        if (removed) return
        removed = true
        if (root.parentNode) root.parentNode.removeChild(root)
      }
      setTimeout(cleanup, BURST_MS)
      return cleanup
    }

    /* =========================================================================
     * Shared DOM helpers
     * ======================================================================= */

    function isComposerTextarea(target) {
      return target instanceof HTMLTextAreaElement
        && target.disabled !== true
        && target.readOnly !== true
        && target === document.activeElement
        && target.closest('[data-composer-card]') !== null
    }

    /**
     * True while the composer's candidate menu (slash command / skill /
     * subagent picker) is open. The official menu is a `role="listbox"`
     * overlay whose Enter handling is arbitrated by the composer — we must
     * NOT swallow Enter while it is open, or pressing Enter to confirm a
     * pick would be blocked by the lock guard.
     */
    function isSuggestionMenuOpen() {
      if (typeof document === 'undefined') return false
      var box = document.querySelector('[role="listbox"]')
      if (box === null) return false
      // Must be visibly attached (the closed menu renders null, so any
      // listbox in the DOM is an open one).
      return box.isConnected && box.offsetParent !== null
    }

    /** Resolve the session id owned by the composer card containing target. */
    function sessionIdFromTarget(target) {
      if (!(target instanceof Element)) return undefined
      var card = target.closest('[data-composer-card]')
      if (card === null) return undefined
      var toggle = card.querySelector('[data-dsh-input-enhancer]')
      if (toggle === null) return undefined
      return toggle.getAttribute('data-dsh-input-enhancer-session')
    }

    /* =========================================================================
     * Feature: character count (independent of the lock)
     *
     * Reads the live draft through the official `useInput` store hoook (a
     * standard prop of `conversation.input.right`) and renders a badge with
     * the total character count. It shows whenever the draft is non-empty,
     * whether or not the composer is locked.
     * ======================================================================= */

    function CharCountBadge(props) {
      var useInput = props.useInput
      var t = props.t
      var input = useInput
        ? useInput(function (s) { return s })
        : undefined
      var draft = input && typeof input.draft === 'string' ? input.draft : ''
      if (draft.length === 0) return null
      var isLong = draft.length >= LONG_TEXT_THRESHOLD
      return React.createElement('span', {
        'data-dsh-char-count': '',
        'data-dsh-long-text': isLong ? '' : undefined,
        title: isLong
          ? t('longTextHint', { count: draft.length })
          : t('charCountHint', { count: draft.length }),
      }, isLong
        ? '\u26A0 ' + draft.length
        : String(draft.length))
    }

    /* =========================================================================
     * Feature: composer lock (Enter guard + enlarge + triple-tap unlock&send)
     *
     * Self-contained: it owns its per-session lock store, the triple-tap
     * gesture timing state, and the live `inputActions` reference needed to
     * submit on the third tap. Everything below is private to this feature;
     * `apply()` only calls `createLockFeature()` and mounts its effects.
     * ======================================================================= */

    function createLockFeature() {
      // Per-session lock flags + the triple-tap gesture count live in one
      // store because the tap gesture is *part of* the lock's escape hatch.
      // `burstUntil` marks the brief "unlock explosion" window after the 3rd
      // tap, during which the lock icon shows the burst animation.
      var store = tinyStore({ sessions: {}, tapCount: 0, burstUntil: 0 })
      var tapTimer = null
      var burstTimer = null
      var inputActionsRef = null

      function isLocked(sessionId) {
        return store.getSnapshot().sessions[sessionId] === true
      }

      function resetTap() {
        if (tapTimer !== null) clearTimeout(tapTimer)
        tapTimer = null
        if (store.getSnapshot().tapCount !== 0) {
          store.set(function (s) { return Object.assign({}, s, { tapCount: 0 }) })
        }
      }

      /** Fire the brief unlock-burst window after the 3rd tap completes. */
      function triggerBurst() {
        if (burstTimer !== null) clearTimeout(burstTimer)
        store.set(function (s) { return Object.assign({}, s, { burstUntil: Date.now() + BURST_MS }) })
        burstTimer = setTimeout(function () {
          burstTimer = null
          if (store.getSnapshot().burstUntil !== 0) {
            store.set(function (s) { return Object.assign({}, s, { burstUntil: 0 }) })
          }
        }, BURST_MS)
      }

      function toggle(sessionId) {
        store.set(function (s) {
          var next = Object.assign({}, s.sessions)
          if (s.sessions[sessionId] === true) delete next[sessionId]
          else next[sessionId] = true
          return Object.assign({}, s, { sessions: next })
        })
      }

      /**
       * Record one Enter tap while locked. Returns true when this tap
       * completes the triple-tap gesture (unlock + send already dispatched),
       * false otherwise.
       */
      function onLockedEnterTap(sessionId) {
        var count = store.getSnapshot().tapCount + 1
        store.set(function (s) { return Object.assign({}, s, { tapCount: count }) })
        if (count >= 3) {
          var nextSessions = Object.assign({}, store.getSnapshot().sessions)
          delete nextSessions[sessionId]
          store.set(function (s) { return Object.assign({}, s, { sessions: nextSessions, tapCount: 0 }) })
          if (tapTimer !== null) clearTimeout(tapTimer)
          tapTimer = null
          // Fire the unlock-burst visual, then submit.
          triggerBurst()
          if (typeof inputActionsRef === 'function') inputActionsRef()
          return true
        }
        if (tapTimer !== null) clearTimeout(tapTimer)
        tapTimer = setTimeout(resetTap, TRIPLE_TAP_WINDOW_MS)
        return false
      }

      function cancelTap() { resetTap() }

      function setInputActions(fn) { inputActionsRef = fn }

      function LockButton(props) {
        var sessionId = props.sessionId
        var inputActions = props.inputActions
        var t = props.t
        // Continuously-tracked viewport center of the lock button. Updated in
        // the button ref callback (which runs against the real DOM element),
        // so the value is always the button's latest on-screen position —
        // including the pre-shrink position on the 3rd tap's burst.
        var lastAnchorRef = React.useRef(null)
        var buttonRef = React.useRef(null)
        var snapshot = useStoreSnapshot(store)
        var locked = sessionId !== undefined && snapshot.sessions[sessionId] === true
        var label = locked ? t('unlockLabel') : t('lockLabel')
        var hint = locked ? t('lockedHint') : t('unlockedHint')
        // Graded tap feedback: 1 and 2 are rendered as digits replacing the
        // lock; the 3rd tap triggers the unlock burst.
        var tapping = snapshot.tapCount === 1 || snapshot.tapCount === 2
          ? snapshot.tapCount
          : 0
        var bursting = snapshot.burstUntil > 0

        function trackAnchor(el) {
          if (el) {
            var r = el.getBoundingClientRect()
            lastAnchorRef.current = {
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
            }
          }
        }
        // Keep the anchor fresh every render while locked, so the pre-shrink
        // (enlarged) coordinate is available on the burst frame. Ref callbacks
        // alone only fire on mount, which would leave the small unlocked
        // position. The effect runs after each commit, when the DOM position
        // reflects the current (enlarged) layout.
        React.useEffect(function () {
          if (!locked) return
          var el = buttonRef.current
          if (el) {
            var r = el.getBoundingClientRect()
            lastAnchorRef.current = {
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
            }
          }
        })
        // Expose the current session's submit so the keyboard handler can send
        // on the third Enter tap (the keyboard effect has no slot props).
        React.useEffect(function () {
          setInputActions(inputActions && typeof inputActions.submit === 'function'
            ? function () { inputActions.submit() }
            : function () {})
          return function () { setInputActions(null) }
        }, [inputActions])

        var content = tapping > 0
          ? String(tapping)
          : React.createElement(LockIcon, { locked: locked })

        var button = React.createElement('button', {
          type: 'button',
          ref: function (el) {
            buttonRef.current = el
            if (el) {
              var rr = el.getBoundingClientRect()
              lastAnchorRef.current = {
                x: rr.left + rr.width / 2,
                y: rr.top + rr.height / 2,
              }
            }
          },
          'data-dsh-input-enhancer': '',
          'data-dsh-input-enhancer-session': sessionId,
          'aria-pressed': locked,
          'data-dsh-tap-flash': tapping > 0 ? String(tapping) : undefined,
          'aria-label': label,
          title: hint,
          onMouseDown: function (event) {
            // Keep focus in the composer textarea, matching DSH tool-row buttons.
            event.preventDefault()
          },
          onClick: function () {
            if (sessionId !== undefined) {
              toggle(sessionId)
              cancelTap()
            }
          },
        }, content)

        // Mount the firework onto document.body the moment the burst starts,
        // anchored at the last pre-shrink lock-button center.
        React.useEffect(function () {
          if (!bursting) return
          var anchor = lastAnchorRef.current || { x: 0, y: 0 }
          return mountFirework(anchor)
        }, [bursting])

        return button
      }

      /**
       * Sync the enlarged card class to the current lock state. The card is
       * remounted by React when switching sessions, so this is also driven by
       * a MutationObserver on card insertions (see `mountEffects`).
       */
      function syncCardEnlarged() {
        if (typeof document === 'undefined') return
        var toggles = document.querySelectorAll('[data-dsh-input-enhancer]')
        toggles.forEach(function (toggle) {
          var sessionId = toggle.getAttribute('data-dsh-input-enhancer-session')
          if (sessionId === null || sessionId === undefined) return
          var card = toggle.closest('[data-composer-card]')
          if (card === null) return
          if (isLocked(sessionId)) card.setAttribute('data-dsh-composer-enlarged', '')
          else card.removeAttribute('data-dsh-composer-enlarged')
        })
      }

      function onKeyDown(event) {
        // Lock shortcut: Ctrl/Cmd+Alt+L toggles the current session's lock.
        if (SHORTCUT_ENABLED && isLockShortcut(event)) {
          if (event.isComposing || event.keyCode === 229) return
          var shortcutSessionId = sessionIdFromTarget(event.target)
          if (shortcutSessionId === null || shortcutSessionId === undefined) return
          event.preventDefault()
          event.stopImmediatePropagation()
          toggle(shortcutSessionId)
          return
        }

        if (event.key !== 'Enter') {
          // Any non-Enter key aborts an in-progress triple-tap gesture.
          if (!event.isComposing && event.keyCode !== 229 && isComposerTextarea(event.target)) {
            var anySessionId = sessionIdFromTarget(event.target)
            if (anySessionId !== null && anySessionId !== undefined) cancelTap()
          }
          return
        }
        // Shift+Enter is already a native newline in the official composer
        // and never sends, so leave it untouched (and don't count it).
        if (event.shiftKey) return
        // Never fight an IME: candidate confirmation belongs to the input
        // method, not to this guard.
        if (event.isComposing || event.keyCode === 229) return
        // When the slash/skill/subagent candidate menu is open, Enter belongs
        // to the menu's own arbitration (confirm a pick) — never intercept it
        // here, or selecting a command/skill becomes impossible while locked.
        if (isSuggestionMenuOpen()) return
        if (!isComposerTextarea(event.target)) return
        var sessionId = sessionIdFromTarget(event.target)
        if (sessionId === null || sessionId === undefined || !isLocked(sessionId)) return
        event.preventDefault()
        // stopImmediatePropagation keeps the event from reaching the React
        // root's delegated composer onKeyDown, which would otherwise submit.
        event.stopImmediatePropagation()
        // First two taps have no side effect (still swallowed) but advance
        // the counter; the third tap unlocks and submits.
        onLockedEnterTap(sessionId)
      }

      return {
        LockButton: LockButton,
        store: store,
        mountEffects: function (ctx) {
          // Enlarge card now + on every lock toggle + on card remount.
          ctx.effect(function () {
            syncCardEnlarged()
            var unsubscribe = store.subscribe(syncCardEnlarged)
            var observer = new MutationObserver(function (mutations) {
              var needSync = false
              for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes
                for (var j = 0; j < added.length; j++) {
                  var node = added[j]
                  if (!(node instanceof Element)) continue
                  if (
                    node.matches('[data-composer-card], [data-dsh-input-enhancer]') ||
                    node.querySelector('[data-composer-card], [data-dsh-input-enhancer]') !== null
                  ) {
                    needSync = true
                  }
                }
              }
              if (needSync) syncCardEnlarged()
            })
            observer.observe(document.body, { childList: true, subtree: true })
            return function () {
              observer.disconnect()
              unsubscribe()
            }
          }, 'dsh-input-enhancer: enlarge composer card')

          // Keyboard capture for the Enter guard + triple-tap gesture.
          ctx.effect(function () {
            document.addEventListener('keydown', onKeyDown, true)
            return function () {
              document.removeEventListener('keydown', onKeyDown, true)
            }
          }, 'dsh-input-enhancer: capture composer keyboard')
        },
      }
    }

    /* =========================================================================
     * Default shortcut matcher: Ctrl/Cmd+Alt+L. Toggles the lock on the
     * focused composer session.
     * ======================================================================= */

    function isLockShortcut(event) {
      if (event.repeat) return false
      var key = event.key || ''
      var isL = event.code === 'KeyL' || key.toLowerCase() === 'l'
      if (!isL) return false
      if (event.shiftKey) return false
      if (event.altKey !== true) return false
      return event.ctrlKey === true || event.metaKey === true
    }

    /* =========================================================================
     * Styles: one adopted <style> owns every feature's rules, partitioned by
     * comment. Each feature contributes its own selectors, keyed off its own
     * data-* attributes so they never collide.
     * ======================================================================= */

    function adoptStyles() {
      if (typeof document === 'undefined') return function () {}
      if (document.getElementById(STYLE_ID) !== null) {
        return function () {}
      }
      var style = document.createElement('style')
      style.id = STYLE_ID
      style.setAttribute('data-plugin', NS)
      style.textContent = [
        // ---- lock button --------------------------------------------------
        '[data-dsh-input-enhancer]{',
        'box-sizing:border-box;width:28px;height:28px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;',
        'display:inline-flex;align-items:center;justify-content:center;flex:none;cursor:pointer;',
        'color:var(--dsw-alias-label-secondary);background:transparent;',
        '}',
        '[data-dsh-input-enhancer]:hover{',
        'color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);',
        '}',
        '[data-dsh-input-enhancer][aria-pressed="true"]{',
        'color:#fff;',
        'background:var(--dsw-alias-state-error-primary);',
        'border:1px solid var(--dsw-alias-state-error-primary);',
        '}',
        '[data-dsh-input-enhancer][aria-pressed="true"]:hover{',
        'color:#fff;',
        'background:var(--dsw-alias-state-error-secondary);',
        'border:1px solid var(--dsw-alias-state-error-secondary);',
        '}',
        '[data-dsh-input-enhancer]:focus-visible{',
        'outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;',
        '}',
        // Graded flash pulse on each Enter tap: tap 1 is a gentle pulse,
        // tap 2 is a larger pulse with a stronger halo, hinting "one more to
        // unlock and send". During taps the lock icon is replaced by the
        // count digit ("1" / "2").
        '[data-dsh-input-enhancer][data-dsh-tap-flash]{',
        'font-size:13px;font-weight:600;',
        '}',
        '[data-dsh-input-enhancer][data-dsh-tap-flash="1"]{',
        'animation:dsh-enter-tap-flash-1 .35s ease-in-out;',
        'box-shadow:0 0 0 2px var(--dsw-alias-state-warning-primary);',
        '}',
        '[data-dsh-input-enhancer][data-dsh-tap-flash="2"]{',
        'animation:dsh-enter-tap-flash-2 .35s ease-in-out;',
        'box-shadow:0 0 0 4px var(--dsw-alias-state-warning-primary);',
        '}',
        '@keyframes dsh-enter-tap-flash-1{',
        '0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}',
        '}',
        '@keyframes dsh-enter-tap-flash-2{',
        '0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}',
        '}',
        // Unlock firework (3rd tap): a 1s firework bursts from the lock
        // button's center. It is a fixed overlay so particles escape the
        // 28px button bounds; each particle flies outward (--dsh-fw-dx/dy),
        // falls with slight drift, and fades. The button itself also does a
        // quick snap-back while the firework plays.
        '[data-dsh-firework]{',
        'position:fixed;transform:translate(-50%,-50%);pointer-events:none;z-index:9999;',
        'width:0;height:0;',
        '}',
        // Central flash: a bright ball that swells and fades at the origin.
        '.dsh-firework-core{',
        'position:absolute;left:0;top:0;transform:translate(-50%,-50%);',
        'width:34px;height:34px;border-radius:50%;',
        'background:radial-gradient(circle,#fff 0%,#ffd166 40%,rgba(255,209,102,0) 70%);',
        'animation:dsh-firework-core 1s ease-out forwards;',
        '}',
        '.dsh-firework-flash{',
        'position:absolute;left:0;top:0;transform:translate(-50%,-50%);',
        'width:8px;height:8px;border-radius:50%;background:#fff;',
        'box-shadow:0 0 18px 6px rgba(255,255,255,.9);',
        'animation:dsh-firework-flash .5s ease-out forwards;',
        '}',
        '.dsh-firework-particle{',
        'position:absolute;left:0;top:0;',
        'width:var(--dsh-fw-size,8px);height:var(--dsh-fw-size,8px);border-radius:50%;',
        'background:var(--dsh-fw-color,#ffd166);',
        'box-shadow:0 0 8px 2px var(--dsh-fw-color,#ffd166);',
        'animation:dsh-firework-fly 1s ease-out forwards;',
        '}',
        '@keyframes dsh-firework-core{',
        '0%{transform:translate(-50%,-50%) scale(.4);opacity:1}',
        '40%{transform:translate(-50%,-50%) scale(1.4);opacity:.9}',
        '100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}',
        '}',
        '@keyframes dsh-firework-flash{',
        '0%{transform:translate(-50%,-50%) scale(.6);opacity:1}',
        '100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}',
        '}',
        '@keyframes dsh-firework-fly{',
        '0%{transform:translate(0,0) scale(1);opacity:1}',
        '30%{opacity:1}',
        '100%{transform:translate(var(--dsh-fw-dx),var(--dsh-fw-dy)) scale(.4);opacity:0}',
        '}',
        // Enlarged composer: raised while locked. The card's extra min-height
        // must be consumed by the text region, not by dead space above the
        // tool row — so .scroll absorbs the growth (flex:1) and the tool row
        // stays pinned to the card bottom. --dsh-composer-text-max-height is
        // the auto-grow ceiling (336px by default); min-height guarantees the
        // card is visibly taller immediately on lock. --dsh-composer-height
        // (the scroll anchor) re-syncs for free via the seat ResizeObserver.
        '[data-composer-card][data-dsh-composer-enlarged]{',
        'min-height:40vh;',
        '--dsh-composer-text-max-height:60vh;',
        '}',
        '[data-composer-card][data-dsh-composer-enlarged] [data-input-scroll]{',
        'flex:1 1 auto;min-height:0;display:flex;flex-direction:column;',
        '}',
        // The textarea is `position:absolute; inset:0` inside .grow, and .grow
        // is the .scroll's only child: its height would otherwise track the
        // text content only, leaving dead space below where clicks can't reach
        // the textarea. Stretch .grow so the focusable area fills the enlarged
        // .scroll.
        '[data-composer-card][data-dsh-composer-enlarged] [data-input-scroll] > *{',
        'flex:1 1 auto;min-height:0;',
        '}',
        // ---- character count badge ----------------------------------------
        '[data-dsh-char-count]{',
        'box-sizing:border-box;min-width:20px;height:20px;padding:0 6px;',
        'display:inline-flex;align-items:center;justify-content:center;flex:none;',
        'border-radius:10px;font-size:12px;line-height:20px;',
        'color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);',
        '}',
        // Long-text warning: the same badge turns amber once the draft reaches
        // the threshold, as a persistent pre-send hint.
        '[data-dsh-char-count][data-dsh-long-text]{',
        'color:var(--dsw-alias-state-warn-label);',
        'background:var(--dsw-alias-state-warn-tertiary);',
        '}',
      ].join('')
      document.head.appendChild(style)
      return function () { style.remove() }
    }

    /* =========================================================================
     * Plugin entry: thin orchestration only.
     * ======================================================================= */

    var inject = ['slots', 'locale']

    function apply(ctx) {
      var lockFeature = createLockFeature()

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en })
      }, 'dsh-input-enhancer: dictionaries')

      ctx.effect(function () {
        return adoptStyles()
      }, 'dsh-input-enhancer: styles')

      lockFeature.mountEffects(ctx)

      // Lock button (order 20) then char-count badge (order 30), both in the
      // `conversation.input.right` slot.
      ctx.slots.inject('conversation.input.right', function () {
        return ctx.slots.register({
          name: 'conversation.input.right',
          id: 'dsh-input-enhancer',
          order: 20,
          locale: NS,
          inject: function (sessionId) {
            return { sessionId: sessionId }
          },
        }, lockFeature.LockButton)
      })

      ctx.slots.inject('conversation.input.right', function () {
        return ctx.slots.register({
          name: 'conversation.input.right',
          id: 'dsh-input-enhancer-char-count',
          order: 30,
          locale: NS,
          inject: function () {
            return {}
          },
        }, CharCountBadge)
      })
    }

    module.exports = { name: 'dsh-input-enhancer', inject: inject, apply: apply }
    return module.exports
  },
})
