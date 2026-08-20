window.__ModuleLoader__.load({
  id: 'dsh-input-enhancer',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    var NS = 'dsh-input-enhancer'
    var STYLE_ID = 'dsh-input-enhancer-style'

    /**
     * Keyboard shortcut support is intentionally disabled in this release.
     * The code path below is kept for a future cross-browser implementation;
     * until then the lock button is the supported control.
     */
    var SHORTCUT_ENABLED = false

    var zh = {
      lockLabel: '锁定输入框',
      unlockLabel: '解锁输入框',
      unlockedHint: '已解锁，输入框为默认大小，Enter 可正常发送',
      lockedHint: '已锁定并放大输入框，Enter 不会发送；连按 3 次 Enter 可解锁并立即发送',
    }

    var en = {
      lockLabel: 'Lock composer',
      unlockLabel: 'Unlock composer',
      unlockedHint: 'Unlocked: composer is normal size, Enter sends normally',
      lockedHint: 'Locked and enlarged: Enter will not send. Press Enter 3 times to unlock and send',
    }

    /**
     * Tiny external store. One controller per plugin activation (HMR-safe),
     * holding per-session lock flags in memory only — plus the triple-tap
     * "unlock & send" gesture state and a live reference to the current
     * session's `inputActions` so the keyboard handler can submit.
     * Restarting DSH or refreshing the page clears all state by design: the
     * lock is meant as a temporary guard while editing a draft.
     */
    var TRIPLE_TAP_WINDOW_MS = 800

    function createController() {
      var listeners = new Set()
      var snapshot = { sessions: {}, tapCount: 0 }
      var tapTimer = null
      var inputActionsRef = null

      function publish() {
        listeners.forEach(function (listener) { listener() })
      }

      function resetTap() {
        if (tapTimer !== null) clearTimeout(tapTimer)
        tapTimer = null
        if (snapshot.tapCount !== 0) {
          snapshot = Object.assign({}, snapshot, { tapCount: 0 })
          publish()
        }
      }

      return {
        getSnapshot: function () { return snapshot },
        subscribe: function (listener) {
          listeners.add(listener)
          return function () { listeners.delete(listener) }
        },
        isLocked: function (sessionId) {
          return snapshot.sessions[sessionId] === true
        },
        toggle: function (sessionId) {
          var next = Object.assign({}, snapshot.sessions)
          if (snapshot.sessions[sessionId] === true) delete next[sessionId]
          else next[sessionId] = true
          snapshot = Object.assign({}, snapshot, { sessions: next })
          publish()
        },
        getTapCount: function () { return snapshot.tapCount },
        setInputActions: function (fn) { inputActionsRef = fn },
        /**
         * Record one Enter tap while locked. Returns true when this tap
         * completes the triple-tap gesture (unlock + send already dispatched
         * by this call), false otherwise.
         */
        onLockedEnterTap: function (sessionId) {
          var count = snapshot.tapCount + 1
          snapshot = Object.assign({}, snapshot, { tapCount: count })
          publish()
          if (count >= 3) {
            // Third tap: unlock and send.
            var nextSessions = Object.assign({}, snapshot.sessions)
            delete nextSessions[sessionId]
            snapshot = Object.assign({}, snapshot, { sessions: nextSessions, tapCount: 0 })
            if (tapTimer !== null) clearTimeout(tapTimer)
            tapTimer = null
            publish()
            if (typeof inputActionsRef === 'function') {
              inputActionsRef()
            }
            return true
          }
          if (tapTimer !== null) clearTimeout(tapTimer)
          tapTimer = setTimeout(resetTap, TRIPLE_TAP_WINDOW_MS)
          return false
        },
        cancelTap: function (sessionId) {
          resetTap()
        },
      }
    }

    /** Minimal React binding over the controller snapshot. */
    function useControllerSnapshot(controller) {
      var state = React.useState(controller.getSnapshot())
      var snapshot = state[0]
      var setSnapshot = state[1]
      React.useEffect(function () {
        return controller.subscribe(function () {
          setSnapshot(controller.getSnapshot())
        })
      }, [controller])
      return snapshot
    }

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
     * The lock toggle rendered through the official
     * `conversation.input.right` slot: a small always-visible control in the
     * composer tool row, immediately before the model seat and the primary
     * send button.
     */
    function LockButton(props) {
      var controller = props.controller
      var sessionId = props.sessionId
      var inputActions = props.inputActions
      var t = props.t
      var snapshot = useControllerSnapshot(controller)
      var locked = sessionId !== undefined && snapshot.sessions[sessionId] === true
      var label = locked ? t('unlockLabel') : t('lockLabel')
      var hint = locked ? t('lockedHint') : t('unlockedHint')
      // Graded tap feedback: 1 -> gentle pulse, 2 -> larger pulse.
      var tapFlash = snapshot.tapCount === 1 || snapshot.tapCount === 2
        ? String(snapshot.tapCount)
        : undefined
      // Expose the current session's submit so the keyboard handler can send
      // on the third Enter tap. Kept in the controller because the keyboard
      // capture effect has no direct access to the slot's standard props.
      React.useEffect(function () {
        controller.setInputActions(inputActions && typeof inputActions.submit === 'function'
          ? function () { inputActions.submit() }
          : function () {})
        return function () { controller.setInputActions(null) }
      }, [controller, inputActions])
      return React.createElement('button', {
        type: 'button',
        'data-dsh-input-enhancer': '',
        'data-dsh-input-enhancer-session': sessionId,
        'aria-pressed': locked,
        'data-dsh-tap-flash': tapFlash,
        'aria-label': label,
        title: hint,
        onMouseDown: function (event) {
          // Keep focus in the composer textarea, matching DSH tool-row buttons.
          event.preventDefault()
        },
        onClick: function () {
          if (sessionId !== undefined) {
            controller.toggle(sessionId)
            controller.cancelTap(sessionId)
          }
        },
      }, React.createElement(LockIcon, { locked: locked }))
    }

    function adoptStyles() {
      if (typeof document === 'undefined') return function () {}
      if (document.getElementById(STYLE_ID) !== null) {
        return function () {}
      }
      var style = document.createElement('style')
      style.id = STYLE_ID
      style.setAttribute('data-plugin', NS)
      style.textContent = [
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
        // unlock and send".
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
        'flex:1 1 auto;min-height:0;',
        '}',
      ].join('')
      document.head.appendChild(style)
      return function () { style.remove() }
    }

    function isComposerTextarea(target) {
      return target instanceof HTMLTextAreaElement
        && target.disabled !== true
        && target.readOnly !== true
        && target === document.activeElement
        && target.closest('[data-composer-card]') !== null
    }

    /**
     * Default shortcut: Ctrl+Alt+L on Windows/Linux, Cmd+Alt+L on macOS.
     *
     * Deliberately NOT Ctrl+L (Chrome and Edge both reserve it for the
     * address bar) and NOT Ctrl+Shift+L (Edge reserves it for Paste and
     * search / Paste and go). Ctrl+Alt+L is absent from both browsers'
     * published shortcut tables.
     */
    function isLockShortcut(event) {
      if (event.repeat) return false
      // Match the physical L key first (event.code), then fall back to the
      // produced character. On layouts where Ctrl+Alt is AltGr, event.key
      // may be "ł" or another character while event.code is still "KeyL".
      var key = event.key || ''
      var isL = event.code === 'KeyL' || key.toLowerCase() === 'l'
      if (!isL) return false
      if (event.shiftKey) return false
      if (event.altKey !== true) return false
      return event.ctrlKey === true || event.metaKey === true
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

    var inject = ['slots', 'locale']

    /**
     * Sync the enlarged card class to the current lock state.
     *
     * The lock button lives inside the card, so we resolve the card element
     * from the toggle's `data-dsh-input-enhancer` stamp (closest
     * `[data-composer-card]`). The class is applied as a plain DOM mutation so
     * it has zero React ownership: growth is driven purely by CSS custom
     * properties, and the seat ResizeObserver re-syncs --dsh-composer-height
     * for free. Scope is per-session: re-running on every snapshot publish
     * handles cards that remount (e.g. switching sessions) by re-applying the
     * class where it disappeared.
     */
    function syncCardEnlarged(controller) {
      if (typeof document === 'undefined') return
      var toggles = document.querySelectorAll('[data-dsh-input-enhancer]')
      toggles.forEach(function (toggle) {
        var sessionId = toggle.getAttribute('data-dsh-input-enhancer-session')
        if (sessionId === null || sessionId === undefined) return
        var card = toggle.closest('[data-composer-card]')
        if (card === null) return
        if (controller.isLocked(sessionId)) {
          card.setAttribute('data-dsh-composer-enlarged', '')
        } else {
          card.removeAttribute('data-dsh-composer-enlarged')
        }
      })
    }

    function apply(ctx) {
      var controller = createController()

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en })
      }, 'dsh-input-enhancer: dictionaries')

      ctx.effect(function () {
        return adoptStyles()
      }, 'dsh-input-enhancer: styles')

      ctx.effect(function () {
        function onToggle() {
          syncCardEnlarged(controller)
        }
        // Immediate pass for already-mounted cards, then track every toggle.
        onToggle()
        var unsubscribe = controller.subscribe(onToggle)

        // The composer card is remounted by React when switching sessions,
        // which drops the `data-dsh-composer-enlarged` attribute even though
        // the lock snapshot is unchanged (no publish fires). Watch for card
        // insertions and re-apply the class, so a locked session stays
        // enlarged when you switch away and back.
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
          if (needSync) onToggle()
        })
        observer.observe(document.body, { childList: true, subtree: true })

        return function () {
          observer.disconnect()
          unsubscribe()
        }
      }, 'dsh-input-enhancer: enlarge composer card')

      ctx.effect(function () {
        function onKeyDown(event) {
          // Reserved for future development: cross-browser shortcut support.
          if (SHORTCUT_ENABLED && isLockShortcut(event)) {
            if (event.isComposing || event.keyCode === 229) return
            var shortcutSessionId = sessionIdFromTarget(event.target)
            if (shortcutSessionId === null || shortcutSessionId === undefined) return
            event.preventDefault()
            event.stopImmediatePropagation()
            controller.toggle(shortcutSessionId)
            return
          }

          if (event.key !== 'Enter') {
            // Any non-Enter key aborts an in-progress triple-tap gesture.
            if (!event.isComposing && event.keyCode !== 229 && isComposerTextarea(event.target)) {
              var anySessionId = sessionIdFromTarget(event.target)
              if (anySessionId !== null && anySessionId !== undefined) controller.cancelTap(anySessionId)
            }
            return
          }
          // Shift+Enter is already a native newline in the official composer
          // and never sends, so leave it untouched (and don't count it).
          if (event.shiftKey) return
          // Never fight an IME: candidate confirmation belongs to the input
          // method, not to this guard.
          if (event.isComposing || event.keyCode === 229) return
          if (!isComposerTextarea(event.target)) return
          var sessionId = sessionIdFromTarget(event.target)
          if (sessionId === null || sessionId === undefined || !controller.isLocked(sessionId)) return
          event.preventDefault()
          // stopImmediatePropagation keeps the event from reaching the React
          // root's delegated composer onKeyDown, which would otherwise submit.
          event.stopImmediatePropagation()
          // First two taps have no side effect (still swallowed) but advance
          // the counter; the third tap unlocks and submits.
          controller.onLockedEnterTap(sessionId)
        }
        document.addEventListener('keydown', onKeyDown, true)
        return function () {
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, 'dsh-input-enhancer: capture composer keyboard')

      ctx.slots.inject('conversation.input.right', function () {
        return ctx.slots.register({
          name: 'conversation.input.right',
          id: 'dsh-input-enhancer',
          order: 20,
          locale: NS,
          inject: function (sessionId) {
            return { controller: controller, sessionId: sessionId }
          },
        }, LockButton)
      })
    }

    module.exports = { name: 'dsh-input-enhancer', inject: inject, apply: apply }
    return module.exports
  },
})
