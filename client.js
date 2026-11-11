/**
 * Browser half: the Secrets panel (global scope), the workspace menu entry, the
 * session View tab, and their dialogs. Everything renders through slots with
 * plain React and theme tokens; values are written through the shipped
 * credential Remote and are never read back.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-secret-variables',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const NS = 'secret-variables'
    const ROUTE = '/api/secret-variables'

    const STRINGS = {
      zh: {
        'panel.title': '密钥管理',
        'view.title': '密钥管理',
        'source.global': '全局',
        'source.workspace': '项目',
        'source.session': '会话',
        'source.auto': '自动',
        'group.session': '本会话变量',
        'group.workspace': '本项目变量',
        'group.global': '全局变量',
        'group.auto': '自动检测',
        'group.session.hint': '仅本会话可用',
        'group.workspace.hint': '本项目内共享',
        'group.global.hint': '所有项目可用，可被项目或会话覆盖',
        'group.auto.hint': '从对话中自动识别，仅本次会话',
        'group.auto.empty': '尚未检测到。粘贴形似密钥的内容（如以 sk-、ghp_ 开头）或工具输出中出现密钥时，会自动转成引用并出现在这里；仅保存在本次进程内。',
        'hint.editUpstream': '请在所属页修改',
        'notice.inherited': '项目与全局变量在这里只控制本会话的开关；改值请到项目页或全局页。',
        'notice.inherited.project': '全局变量在这里只控制本项目的开关；改值请到全局页。',
        'state.set': '已设置',
        'state.unset': '未设置',
        'state.enabledOnly': '只看已启用',
        'action.add': '添加',
        'action.save': '保存',
        'action.cancel': '取消',
        'action.delete': '删除',
        'action.close': '关闭',
        'action.setValue': '设置值',
        'action.replaceValue': '更换值',
        'action.clearValue': '清除',
        'action.refresh': '刷新',
        'field.name': '名称',
        'field.value': '值',
        'field.availability': '生效范围',
        'field.allProjects': '全部项目',
        'field.defaultOn': '默认启用',
        'field.enabled': '创建后启用',
        'notice.scopes': '全局行的开关是该密钥在全部项目中的默认状态；项目与会话行分别覆盖它。',
        'scope.noProjects': '还没有项目可选，请先在工作区里创建项目。',
        'empty.globals': '还没有全局密钥。',
        'empty.workspace': '这个项目还没有密钥。',
        'empty.session': '这个会话还没有密钥。',
        'empty.filtered': '本会话还没有启用任何密钥。',
        'notice.values': '值由 Host 保存，写入后不再显示。shell 命令中以 $DSH_SECRET_<NAME> 引用。',
        'notice.onlyShell': '只有一次性的 bash 与 pwsh 命令会收到这些值。',
        'count.enabled': '已启用 {{enabled}} / {{total}}',
        'error.duplicateName': '同一页里已有同名变量，换一个名字再试',
        'error.load': '加载失败',
        'error.save': '保存失败',
      },
      en: {
        'panel.title': 'Secrets',
        'view.title': 'Secrets',
        'source.global': 'Global',
        'source.workspace': 'Project',
        'source.session': 'Session',
        'source.auto': 'Auto',
        'group.session': 'Session variables',
        'group.workspace': 'Project variables',
        'group.global': 'Global variables',
        'group.auto': 'Auto-detected',
        'group.session.hint': 'Available in this session only',
        'group.workspace.hint': 'Shared inside this project',
        'group.global.hint': 'Available everywhere; a project or session can override',
        'group.auto.hint': 'Detected in this conversation; this session only',
        'group.auto.empty': 'Nothing detected yet. Pasting a credential-shaped value (for example sk-, ghp_) or a tool result containing one turns it into a reference and lists it here; it lives in this process only.',
        'hint.editUpstream': 'Edit at its source',
        'notice.inherited': 'Project and global variables only toggle for this session here; edit their values on the project or global page.',
        'notice.inherited.project': 'Global variables only toggle for this project here; edit their values on the global page.',
        'state.set': 'Saved',
        'state.unset': 'No value',
        'state.enabledOnly': 'Only enabled',
        'action.add': 'Add',
        'action.save': 'Save',
        'action.cancel': 'Cancel',
        'action.delete': 'Delete',
        'action.close': 'Close',
        'action.setValue': 'Set value',
        'action.replaceValue': 'Replace value',
        'action.clearValue': 'Clear',
        'action.refresh': 'Refresh',
        'field.name': 'Name',
        'field.value': 'Value',
        'field.availability': 'Availability',
        'field.allProjects': 'All projects',
        'field.defaultOn': 'Enabled by default',
        'field.enabled': 'Enable after adding',
        'notice.scopes': 'A global row switch is the default for every project; project and session rows override it.',
        'scope.noProjects': 'No project to choose yet; create a workspace first.',
        'empty.globals': 'No global secrets yet.',
        'empty.workspace': 'No secret in this project yet.',
        'empty.session': 'No secret in this session yet.',
        'empty.filtered': 'No secret is enabled in this session.',
        'notice.values': 'Values are stored by the Host and never shown again. Shell commands use them as $DSH_SECRET_<NAME>.',
        'notice.onlyShell': 'Only one-shot bash and pwsh commands receive these values.',
        'count.enabled': '{{enabled}} / {{total}} enabled',
        'error.duplicateName': 'A variable with that name already exists here',
        'error.load': 'Could not load',
        'error.save': 'Could not save',
      },
    }

    const COLOR = {
      text: 'var(--dsw-alias-label-primary)',
      secondary: 'var(--dsw-alias-label-secondary)',
      tertiary: 'var(--dsw-alias-label-tertiary)',
      border: 'var(--dsw-alias-border-l2)',
      layer: 'var(--dsw-alias-bg-layer-1)',
      base: 'var(--dsw-alias-bg-base)',
      accent: 'var(--dsw-alias-state-business-primary)',
      danger: 'var(--dsw-alias-state-error-primary)',
      hover: 'var(--dsw-alias-interactive-bg-hover)',
    }

    const CONTROL = 30
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

    const S = {
      page: { padding: '24px 28px', color: COLOR.text, fontSize: 14, boxSizing: 'border-box', height: '100%', overflow: 'auto' },
      header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, minHeight: 32 },
      title: { fontSize: 17, fontWeight: 600, margin: 0, lineHeight: '24px' },
      subtitle: { color: COLOR.secondary, fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 },
      button: {
        height: CONTROL, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '0 12px', borderRadius: 8, border: `1px solid ${COLOR.border}`, background: 'transparent',
        color: COLOR.text, fontSize: 13, lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none',
        fontFamily: 'inherit', boxSizing: 'border-box',
      },
      primary: { border: 'none', background: COLOR.accent, color: '#fff' },
      iconButton: { width: CONTROL, padding: 0 },
      input: {
        height: CONTROL, width: '100%', minWidth: 0, padding: '0 10px', borderRadius: 8,
        border: `1px solid ${COLOR.border}`, background: COLOR.base, color: COLOR.text,
        fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
      },
      inlineField: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
      inlineLabel: { fontSize: 12, color: COLOR.secondary, lineHeight: '16px', whiteSpace: 'nowrap', flex: 'none' },
      check: { display: 'flex', alignItems: 'center', gap: 6, height: CONTROL, fontSize: 13, color: COLOR.text, whiteSpace: 'nowrap' },
      addRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: '0 0 16px' },
      card: { border: `1px solid ${COLOR.border}`, borderRadius: 12, overflow: 'hidden', background: COLOR.layer },
      row: {
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 84px 88px 40px 176px', columnGap: 12,
        alignItems: 'center', minHeight: 52, padding: '8px 14px', boxSizing: 'border-box',
      },
      nameCell: { minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 },
      name: { fontFamily: MONO, fontSize: 13, color: COLOR.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto', minWidth: 0 },
      env: { fontFamily: MONO, fontSize: 11, color: COLOR.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto', minWidth: 0 },
      badge: { justifySelf: 'start', fontSize: 11, lineHeight: '16px', border: `1px solid ${COLOR.border}`, borderRadius: 999, padding: '0 8px', color: COLOR.secondary, whiteSpace: 'nowrap' },
      stateSet: { fontSize: 12, color: COLOR.secondary },
      stateUnset: { fontSize: 12, color: COLOR.danger },
      actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' },
      divider: { borderTop: `1px solid ${COLOR.border}` },
      group: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: `1px solid ${COLOR.border}` },
      groupTitle: { fontSize: 12, fontWeight: 600, color: COLOR.secondary },
      groupHint: { fontSize: 11, color: COLOR.tertiary },
      menu: {
        position: 'fixed', maxHeight: 260, overflow: 'auto', padding: 6, boxSizing: 'border-box',
        background: COLOR.layer, border: `1px solid ${COLOR.border}`, borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.28)', zIndex: 2147483001,
      },
      menuItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
      menuDivider: { borderTop: `1px solid ${COLOR.border}`, margin: '4px 0' },
      menuHint: { padding: '6px 8px', fontSize: 12, color: COLOR.tertiary, whiteSpace: 'normal' },
      notice: { color: COLOR.tertiary, fontSize: 12, marginTop: 12, lineHeight: 1.6 },
      error: { color: COLOR.danger, fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 },
      empty: { padding: '18px 14px', color: COLOR.tertiary, fontSize: 13 },
      backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483000 },
      dialog: { width: 'min(600px, calc(100vw - 32px))', maxHeight: 'min(80vh, 720px)', overflow: 'auto', background: COLOR.layer, color: COLOR.text, borderRadius: 14, padding: 20, boxShadow: '0 18px 60px rgba(0,0,0,0.35)', border: `1px solid ${COLOR.border}`, boxSizing: 'border-box' },
      switch: (on) => ({
        position: 'relative', width: 34, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? COLOR.accent : COLOR.border, transition: 'background 120ms ease', flex: 'none', justifySelf: 'center',
      }),
      knob: (on) => ({ position: 'absolute', top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: 999, background: '#fff', transition: 'left 120ms ease' }),
    }

    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        getSnapshot: () => value,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        set(next) {
          value = typeof next === 'function' ? next(value) : next
          for (const listener of [...listeners]) listener()
        },
      }
    }

    function useStore(store) {
      return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
    }

    async function request(path, init) {
      const response = await fetch(`${ROUTE}${path}`, {
        ...init,
        headers: { accept: 'application/json', ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }), ...(init?.headers ?? {}) },
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || body?.ok !== true) {
        const error = new Error(body?.message ?? `HTTP ${response.status}`)
        error.code = body?.error
        throw error
      }
      return body.data
    }

    function useRemote(load, deps) {
      const [version, setVersion] = React.useState(0)
      const [state, setState] = React.useState({ data: null, error: null })
      React.useEffect(() => {
        let alive = true
        setState((current) => ({ ...current, error: null }))
        load()
          .then((data) => {
            if (alive) setState({ data, error: null })
          })
          .catch((error) => {
            if (alive) setState({ data: null, error: error.message ?? String(error) })
          })
        return () => {
          alive = false
        }
      }, [...deps, version])
      return { ...state, reload: React.useCallback(() => setVersion((value) => value + 1), []) }
    }

    /** Localized text for an API failure. */
    function failureText(t, error) {
      if (error?.code === 'DUPLICATE_NAME') return t('error.duplicateName')
      return error?.message ?? String(error)
    }

    /** Fill a template such as `{{enabled}} / {{total}}`. */
    function fill(template, values) {
      let out = template
      for (const [key, value] of Object.entries(values)) out = out.split(`{{${key}}}`).join(String(value))
      return out
    }

    function Button({ children, onClick, primary, danger, title, disabled, style }) {
      return h('button', {
        type: 'button',
        title,
        disabled,
        onClick,
        style: {
          ...S.button,
          ...(primary ? S.primary : {}),
          ...(danger ? { color: COLOR.danger } : {}),
          ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}),
          ...(style ?? {}),
        },
      }, children)
    }

    function IconButton({ children, onClick, title }) {
      return h(Button, { onClick, title, style: S.iconButton }, children)
    }

    function Switch({ checked, onChange, label, disabled }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': checked,
        'aria-label': label,
        title: label,
        disabled,
        onClick: () => onChange(!checked),
        style: { ...S.switch(checked), opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' },
      }, h('span', { style: S.knob(checked) }))
    }

    /** Normalize a stored availability value into `{ all, ids }`. */
    function scopeOf(availability) {
      const ids = Array.isArray(availability) ? availability : []
      return ids.length === 0 ? { all: true, ids: [] } : { all: false, ids }
    }

    /** Picking a project clears 全部项目; dropping the last project falls back to it. */
    function nextScope(scope, id) {
      const ids = scope.all
        ? [id]
        : (scope.ids.includes(id) ? scope.ids.filter((entry) => entry !== id) : [...scope.ids, id])
      return ids.length === 0 ? { all: true, ids: [] } : { all: false, ids }
    }

    /** A one-button availability picker: 全部项目 by default, any number of projects. */
    function ScopeSelect({ t, workspaces = [], scope, onChange, onOpenChange, compact }) {
      const [open, setOpen] = React.useState(false)
      const [rect, setRect] = React.useState(null)
      const anchor = React.useRef(null)
      const names = scope.all
        ? [t('field.allProjects')]
        : scope.ids.map((id) => workspaces.find((workspace) => workspace.id === id)?.title ?? id)
      const label = names.length > 2
        ? `${names.slice(0, 2).join('、')} +${names.length - 2}`
        : names.join('、')

      const place = React.useCallback(() => {
        const box = anchor.current?.getBoundingClientRect()
        if (box === undefined || box === null) return null
        const width = Math.max(box.width, 200)
        return { left: Math.min(box.left, window.innerWidth - width - 8), top: box.bottom + 4, width }
      }, [])
      const show = (next) => {
        setOpen(next)
        if (onOpenChange !== undefined) onOpenChange(next)
      }
      const toggle = () => {
        if (open) {
          show(false)
          return
        }
        setRect(place())
        show(true)
      }
      React.useEffect(() => {
        if (!open) return undefined
        const move = () => {
          const next = place()
          if (next !== null) setRect(next)
        }
        const onDown = (event) => {
          const target = event.target
          if (anchor.current !== null && anchor.current.contains(target)) return
          if (target !== null && typeof target.closest === 'function' && target.closest('[data-secret-scope-menu]') !== null) return
          show(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') show(false)
        }
        window.addEventListener('mousedown', onDown)
        window.addEventListener('keydown', onKey)
        window.addEventListener('scroll', move, true)
        window.addEventListener('resize', move)
        return () => {
          window.removeEventListener('mousedown', onDown)
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('scroll', move, true)
          window.removeEventListener('resize', move)
        }
      }, [open, place])

      const menu = open && rect !== null
        ? ReactDOM.createPortal(
          h('div', {
            'data-secret-scope-menu': 'true',
            role: 'group',
            'aria-label': t('field.availability'),
            style: { ...S.menu, left: rect.left, top: rect.top, minWidth: rect.width },
          },
          h('label', { style: S.menuItem },
            h('input', { type: 'checkbox', checked: scope.all, onChange: () => onChange({ all: true, ids: [] }) }),
            t('field.allProjects')),
          h('div', { style: S.menuDivider }),
          workspaces.length === 0
            ? h('div', { style: S.menuHint }, t('scope.noProjects'))
            : workspaces.map((workspace) => h('label', { key: workspace.id, style: S.menuItem },
              h('input', {
                type: 'checkbox',
                checked: scope.all === false && scope.ids.includes(workspace.id),
                onChange: () => onChange(nextScope(scope, workspace.id)),
              }),
              workspace.title ?? workspace.path ?? workspace.id))),
          document.body)
        : null

      return h(React.Fragment, null,
        h('button', {
          ref: anchor,
          type: 'button',
          'aria-haspopup': 'true',
          'aria-expanded': open,
          title: names.join('、'),
          onClick: toggle,
          style: compact === true
            ? {
              ...S.badge, display: 'inline-flex', alignItems: 'center', gap: 4, height: 24,
              padding: '0 8px', borderRadius: 999, background: 'transparent', cursor: 'pointer',
              maxWidth: '100%', fontFamily: 'inherit', boxSizing: 'border-box', overflow: 'hidden',
            }
            : { ...S.input, display: 'flex', alignItems: 'center', gap: 6, width: 190, flex: 'none', cursor: 'pointer', textAlign: 'left' },
        },
        h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
        h('span', { style: { flex: 'none', fontSize: compact === true ? 9 : 10, color: COLOR.tertiary } }, '▾')),
        menu)
    }

    function ErrorLine({ children }) {
      return children === null || children === undefined ? null : h('div', { style: S.error }, children)
    }

    function Dialog({ open, title, onClose, children }) {
      React.useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [open, onClose])
      if (!open) return null
      return ReactDOM.createPortal(
        h('div', { style: S.backdrop, onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() } },
          h('div', { style: S.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            h('div', { style: { ...S.header, marginBottom: 14 } },
              h('h2', { style: { ...S.title, fontSize: 16 } }, title),
              h('div', { style: { flex: 1 } }),
              h(IconButton, { onClick: onClose, title: 'Close' }, '✕')),
            children)),
        document.body,
      )
    }

    // ------------------------------------------------------------------ row
    // One row, one line: the value input, the availability chips, the switch and
    // Save/Cancel all live inside the row that is being edited.
    function SecretRow(props) {
      const {
        t, remote, item, checked, onToggle, onDelete, onSave, onChanged,
        canDelete, canEditValue, toggleDisabled, badge, badgeTitle,
        canEditScope, workspaces,
      } = props
      const projects = workspaces ?? []
      const [editing, setEditing] = React.useState(false)
      const [value, setValue] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [scope, setScope] = React.useState(() => scopeOf(item.availability))
      const [menuOpen, setMenuOpen] = React.useState(false)
      const hasValue = item.set !== false
      const sameScope = (left, right) => left.all === right.all
        && [...left.ids].sort().join(',') === [...right.ids].sort().join(',')
      const scopeChanged = canEditScope === true && !sameScope(scope, scopeOf(item.availability))
      const canSave = value.length > 0 || scopeChanged

      const start = () => {
        setValue('')
        setError(null)
        setMenuOpen(false)
        setScope(scopeOf(item.availability))
        setEditing(true)
      }
      const cancel = () => {
        setEditing(false)
        setValue('')
        setError(null)
        setMenuOpen(false)
      }
      const save = async () => {
        if (busy || !canSave) return
        setBusy(true)
        setError(null)
        try {
          if (value.length > 0) await remote.credentials.set(item.ref, value)
          if (canEditScope === true && onSave !== undefined) {
            await onSave({ availability: scope.all ? 'all' : [...scope.ids] })
          }
          setEditing(false)
          setValue('')
          onChanged()
        } catch (failure) {
          setError(failure?.message ?? String(failure))
        } finally {
          setBusy(false)
        }
      }

      // Same grid as the read view: nothing moves; the env text becomes the
      // value input on the same line, and the scope chip becomes the picker.
      if (editing) {
        return h('div', { style: S.divider },
          h('div', { style: S.row },
            h('div', { style: S.nameCell },
              h('span', { style: S.name, title: item.name }, item.name),
              h('input', {
                type: 'password',
                autoComplete: 'off',
                'aria-label': t('field.value'),
                placeholder: hasValue ? t('action.replaceValue') : t('action.setValue'),
                value,
                autoFocus: true,
                onChange: (event) => setValue(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') save()
                  if (event.key === 'Escape' && menuOpen === false) cancel()
                },
                style: { ...S.input, flex: '1 1 60px', height: 22, padding: '0 8px', fontSize: 12, borderRadius: 6 },
              })),
            canEditScope === true
              ? h(ScopeSelect, { t, workspaces: projects, scope, onChange: setScope, onOpenChange: setMenuOpen, compact: true })
              : h('span', { style: S.badge, title: badgeTitle }, badge ?? t(`source.${item.source}`)),
            h('span', { style: hasValue ? S.stateSet : S.stateUnset }, hasValue ? t('state.set') : t('state.unset')),
            h(Switch, { checked, onChange: onToggle, label: item.name, disabled: toggleDisabled === true }),
            h('div', { style: S.actions },
              h(Button, { onClick: save, primary: true, disabled: busy || !canSave }, t('action.save')),
              h(Button, { onClick: cancel, disabled: busy }, t('action.cancel')))),
          error === null ? null : h('div', { style: { ...S.error, padding: '0 14px 8px' } }, error))
      }

      return h('div', { style: S.divider },
        h('div', { style: S.row },
          h('div', { style: S.nameCell },
            h('span', { style: S.name, title: item.name }, item.name),
            h('span', { style: S.env, title: `$${item.envName}` }, `$${item.envName}`)),
          h('span', { style: S.badge, title: badgeTitle }, badge ?? t(`source.${item.source}`)),
          h('span', { style: hasValue ? S.stateSet : S.stateUnset }, hasValue ? t('state.set') : t('state.unset')),
          h(Switch, { checked, onChange: onToggle, label: item.name, disabled: toggleDisabled === true }),
          h('div', { style: S.actions },
            canEditValue === false
              ? (item.source === 'workspace' || item.source === 'global'
                ? h('span', { style: { fontSize: 12, color: COLOR.tertiary } }, t('hint.editUpstream'))
                : null)
              : h(Button, { onClick: start }, hasValue ? t('action.replaceValue') : t('action.setValue')),
            canDelete === true
              ? h(Button, { danger: true, onClick: onDelete, title: t('action.delete') }, '✕')
              : h('span', { style: { width: CONTROL, flex: 'none' } }))))
    }

    function PageHeader({ t, title, summary, onRefresh }) {
      return h('div', { style: S.header },
        h('h1', { style: S.title }, title),
        summary === undefined ? null : h('span', { style: { ...S.badge, marginLeft: 2 } }, summary),
        h('div', { style: { flex: 1 } }),
        onRefresh === undefined ? null : h(IconButton, { onClick: onRefresh, title: t('action.refresh') }, '↻'))
    }

    // ---------------------------------------------------------------- panel
    function GlobalPanel(props) {
      const { t, remote } = props
      const { data: directory } = useRemote(() => request('?op=workspaces'), [])
      const workspaces = Array.isArray(directory?.workspaces) ? directory.workspaces : []
      const { data, error, reload } = useRemote(() => request('?op=globals'), [])
      const [name, setName] = React.useState('')
      const [value, setValue] = React.useState('')
      const [scope, setScope] = React.useState({ all: true, ids: [] })
      const [defaultOn, setDefaultOn] = React.useState(false)
      const [failure, setFailure] = React.useState(null)

      const add = async () => {
        setFailure(null)
        let ref
        try {
          const created = await request('', { method: 'POST', body: JSON.stringify({
            op: 'addGlobal', name, availability: scope.all ? 'all' : [...scope.ids], enabledByDefault: defaultOn,
          }) })
          ref = created?.global?.ref
        } catch (error) {
          setFailure(failureText(t, error))
          return
        }
        if (value.length > 0 && ref !== undefined) {
          try {
            await remote.credentials.set(ref, value)
          } catch (error) {
            setFailure(`${t('error.save')}: ${error.message ?? String(error)}`)
          }
        }
        setName('')
        setValue('')
        reload()
      }

      const remove = async (id) => {
        setFailure(null)
        try {
          await request('', { method: 'POST', body: JSON.stringify({ op: 'removeGlobal', id }) })
          reload()
        } catch (error) {
          setFailure(error.message)
        }
      }

      const toggle = async (global, next) => {
        setFailure(null)
        try {
          await request('', { method: 'POST', body: JSON.stringify({
            op: 'updateGlobal', id: global.id, name: global.name, availability: global.availability, enabledByDefault: next,
          }) })
          reload()
        } catch (error) {
          setFailure(error.message)
        }
      }

      const scopeNames = (global) => (global.availability === 'all'
        ? [t('field.allProjects')]
        : global.availability.map((id) => workspaces.find((workspace) => workspace.id === id)?.title ?? id))
      const scopeLabel = (global) => {
        const names = scopeNames(global)
        return names.length > 2 ? names.slice(0, 2).join('、') + ' +' + (names.length - 2) : names.join('、')
      }
      const globals = data?.globals ?? []
      const enabledCount = globals.filter((global) => global.enabledByDefault).length
      return h('div', { style: S.page },
        h(PageHeader, { t, title: t('panel.title'), summary: fill(t('count.enabled'), { enabled: enabledCount, total: globals.length }), onRefresh: reload }),
        h('p', { style: S.subtitle }, t('notice.values')),
        h('div', { style: S.addRow },
          h('label', { style: S.inlineField },
            h('span', { style: S.inlineLabel }, t('field.name')),
            h('input', {
              value: name,
              onChange: (event) => setName(event.target.value),
              placeholder: 'OPENAI_API_KEY',
              style: { ...S.input, width: 170, flex: 'none' },
            })),
          h('label', { style: S.inlineField },
            h('span', { style: S.inlineLabel }, t('field.value')),
            h('input', {
              type: 'password',
              autoComplete: 'off',
              value,
              onChange: (event) => setValue(event.target.value),
              style: { ...S.input, flex: '1 1 160px', width: 'auto', minWidth: 140, maxWidth: 280 },
            })),
          h('div', { style: S.inlineField },
            h('span', { style: S.inlineLabel }, t('field.availability')),
            h(ScopeSelect, { t, workspaces, scope, onChange: setScope })),
          h('label', { style: S.check }, h('input', { type: 'checkbox', checked: defaultOn, onChange: (event) => setDefaultOn(event.target.checked) }), t('field.enabled')),
          h(Button, { onClick: add, primary: true, disabled: name.trim().length === 0 }, t('action.add'))),
        h(ErrorLine, null, failure),
        h(ErrorLine, null, error === null ? null : `${t('error.load')}: ${error}`),
        h('div', { style: S.card },
          globals.length === 0
            ? h('div', { style: S.empty }, t('empty.globals'))
            : globals.map((global) => h(SecretRow, {
              key: global.id,
              t,
              remote,
              item: { ...global, source: 'global', envName: global.envName },
              badge: scopeLabel(global),
              badgeTitle: scopeNames(global).join('、'),
              checked: global.enabledByDefault,
              onToggle: (next) => toggle(global, next),
              onDelete: () => remove(global.id),
              onSave: (next) => request('', { method: 'POST', body: JSON.stringify({
                op: 'updateGlobal', id: global.id, name: global.name,
                availability: next.availability, enabledByDefault: global.enabledByDefault,
              }) }),
              onChanged: reload,
              canDelete: true,
              canEditScope: true,
              workspaces,
            }))),
        h('p', { style: S.notice }, t('notice.scopes')),
        h('p', { style: S.notice }, t('notice.onlyShell')))
    }

    // ------------------------------------------------------------- workspace
    function WorkspaceDialog({ t, remote, dialog }) {
      const state = useStore(dialog)
      const workspaceId = state.workspaceId
      const { data, error, reload } = useRemote(
        () => (workspaceId === null ? Promise.resolve(null) : request(`?op=workspace&workspaceId=${encodeURIComponent(workspaceId)}`)),
        [workspaceId],
      )
      const [name, setName] = React.useState('')
      const [value, setValue] = React.useState('')
      const [enabledOn, setEnabledOn] = React.useState(true)
      const [failure, setFailure] = React.useState(null)
      const close = React.useCallback(() => dialog.set({ open: false, workspaceId: null, title: '' }), [dialog])

      const add = async () => {
        setFailure(null)
        let ref
        try {
          const created = await request('', { method: 'POST', body: JSON.stringify({ op: 'addWorkspaceVar', workspaceId, name, enabledByDefault: enabledOn }) })
          ref = created?.variable?.ref
        } catch (error) {
          setFailure(failureText(t, error))
          return
        }
        if (value.length > 0 && ref !== undefined) {
          try {
            await remote.credentials.set(ref, value)
          } catch (error) {
            setFailure(`${t('error.save')}: ${error.message ?? String(error)}`)
          }
        }
        setName('')
        setValue('')
        reload()
      }

      const mutate = async (body) => {
        setFailure(null)
        try {
          await request('', { method: 'POST', body: JSON.stringify(body) })
          reload()
        } catch (error) {
          setFailure(error.message)
        }
      }

      const workspaceRows = (data?.variables ?? []).map((variable) => ({
        item: { ...variable, source: 'workspace' },
        checked: variable.override ?? variable.enabledByDefault,
        toggle: (next) => mutate({ op: 'setWorkspaceOverride', workspaceId, variableId: variable.id, enabled: next }),
        remove: () => mutate({ op: 'removeWorkspaceVar', workspaceId, id: variable.id }),
      }))
      const globalRows = (data?.globals ?? []).map((global) => ({
        item: { ...global, source: 'global' },
        checked: global.override ?? global.enabledByDefault,
        toggle: (next) => mutate({ op: 'setWorkspaceOverride', workspaceId, variableId: global.id, enabled: next }),
      }))
      const groups = PROJECT_GROUPS
        .map((source) => ({ source, rows: source === 'workspace' ? workspaceRows : globalRows }))
        .filter((group) => group.rows.length > 0)

      return h(Dialog, { open: state.open, title: `${t('panel.title')} · ${t('source.workspace')}`, onClose: close },
        h('p', { style: S.subtitle }, state.title ?? ''),
        h('div', { style: S.addRow },
          h('label', { style: S.inlineField },
            h('span', { style: S.inlineLabel }, t('field.name')),
            h('input', {
              value: name,
              onChange: (event) => setName(event.target.value),
              placeholder: 'PROJECT_TOKEN',
              style: { ...S.input, width: 150, flex: 'none' },
            })),
          h('label', { style: S.inlineField },
            h('span', { style: S.inlineLabel }, t('field.value')),
            h('input', {
              type: 'password',
              autoComplete: 'off',
              value,
              onChange: (event) => setValue(event.target.value),
              style: { ...S.input, flex: '1 1 140px', width: 'auto', minWidth: 120, maxWidth: 240 },
            })),
          h('label', { style: S.check }, h('input', { type: 'checkbox', checked: enabledOn, onChange: (event) => setEnabledOn(event.target.checked) }), t('field.enabled')),
          h(Button, { primary: true, disabled: name.trim().length === 0, onClick: add }, t('action.add'))),
        h(ErrorLine, null, failure),
        h(ErrorLine, null, error === null ? null : `${t('error.load')}: ${error}`),
        h('div', { style: S.card },
          groups.length === 0
            ? h('div', { style: S.empty }, t('empty.workspace'))
            : groups.map((group, index) => h(React.Fragment, { key: group.source },
              h('div', { style: index === 0 ? { ...S.group, borderTop: 'none' } : S.group },
                h('span', { style: S.groupTitle }, t('group.' + group.source)),
                h('span', { style: S.badge }, String(group.rows.length)),
                h('div', { style: { flex: 1 } }),
                h('span', { style: S.groupHint }, t('group.' + group.source + '.hint'))),
              group.rows.map((row) => h(SecretRow, {
                key: row.item.id,
                t,
                remote,
                item: row.item,
                checked: row.checked,
                onToggle: row.toggle,
                onDelete: row.remove,
                onChanged: reload,
                canDelete: row.remove !== undefined,
                canEditValue: row.item.source === 'workspace',
              }))))),
        h('p', { style: S.notice }, t('notice.inherited.project')),
        h('p', { style: S.notice }, t('notice.values')))
    }

    const GROUPS = ['session', 'workspace', 'global', 'auto']
    const PROJECT_GROUPS = ['workspace', 'global']

    // -------------------------------------------------------------- session
    function SessionPanel({ t, remote, sessionId }) {
      const { data, error, reload } = useRemote(() => request(`?op=session&sessionId=${encodeURIComponent(sessionId)}`), [sessionId])
      const [name, setName] = React.useState('')
      const [value, setValue] = React.useState('')
      const [enabledOn, setEnabledOn] = React.useState(true)
      const [failure, setFailure] = React.useState(null)
      const [onlyEnabled, setOnlyEnabled] = React.useState(false)

      const items = data?.items ?? []
      const enabled = data?.enabledCount ?? 0
      const total = data?.total ?? 0
      const visible = onlyEnabled ? items.filter((item) => item.enabled) : items

      const add = async () => {
        setFailure(null)
        let ref
        try {
          const created = await request('', { method: 'POST', body: JSON.stringify({ op: 'addSessionVar', sessionId, name, enabledByDefault: enabledOn }) })
          ref = created?.variable?.ref
        } catch (error) {
          setFailure(failureText(t, error))
          return
        }
        if (value.length > 0 && ref !== undefined) {
          try {
            await remote.credentials.set(ref, value)
          } catch (error) {
            setFailure(`${t('error.save')}: ${error.message ?? String(error)}`)
          }
        }
        setName('')
        setValue('')
        reload()
      }

      const mutate = async (body) => {
        setFailure(null)
        try {
          await request('', { method: 'POST', body: JSON.stringify(body) })
          reload()
        } catch (error) {
          setFailure(error.message)
        }
      }

      return h('div', { style: S.page },
        h(PageHeader, { t, title: t('panel.title'), summary: fill(t('count.enabled'), { enabled, total }), onRefresh: reload }),
        h('div', { style: S.addRow },
          h('label', { style: S.inlineField },
            h('span', { style: S.inlineLabel }, t('field.name')),
            h('input', {
              value: name,
              onChange: (event) => setName(event.target.value),
              placeholder: 'SESSION_TOKEN',
              style: { ...S.input, width: 150, flex: 'none' },
            })),
          h('label', { style: S.inlineField },
            h('span', { style: S.inlineLabel }, t('field.value')),
            h('input', {
              type: 'password',
              autoComplete: 'off',
              value,
              onChange: (event) => setValue(event.target.value),
              style: { ...S.input, flex: '1 1 140px', width: 'auto', minWidth: 120, maxWidth: 240 },
            })),
          h('label', { style: S.check }, h('input', { type: 'checkbox', checked: enabledOn, onChange: (event) => setEnabledOn(event.target.checked) }), t('field.enabled')),
          h(Button, { primary: true, disabled: name.trim().length === 0, onClick: add }, t('action.add'))),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 } },
          h('label', { style: { ...S.check, height: 'auto' } },
            h('input', { type: 'checkbox', checked: onlyEnabled, onChange: (event) => setOnlyEnabled(event.target.checked) }),
            t('state.enabledOnly')),
          h('div', { style: { flex: 1 } }),
          h('span', { style: { ...S.badge, border: 'none', color: COLOR.tertiary } }, t('notice.onlyShell'))),
        h(ErrorLine, null, failure),
        h(ErrorLine, null, error === null ? null : `${t('error.load')}: ${error}`),
        h('div', { style: S.card },
          visible.length === 0
            ? h('div', { style: S.empty }, h('div', null, onlyEnabled ? t('empty.filtered') : t('empty.session')), h('div', { style: { marginTop: 6, fontSize: 12 } }, t('group.auto.empty')))
            : GROUPS
              .map((source) => ({ source, rows: visible.filter((item) => item.source === source) }))
              .filter((group) => group.rows.length > 0 || group.source === 'auto')
              .map((group, index) => h(React.Fragment, { key: group.source },
                h('div', { style: index === 0 ? { ...S.group, borderTop: 'none' } : S.group },
                  h('span', { style: S.groupTitle }, t('group.' + group.source)),
                  h('span', { style: S.badge }, String(group.rows.length)),
                  h('div', { style: { flex: 1 } }),
                  h('span', { style: S.groupHint }, t('group.' + group.source + '.hint'))),
                group.rows.length === 0
                  ? h('div', { style: S.empty }, t('group.auto.empty'))
                  : group.rows.map((item) => h(SecretRow, {
                  key: item.id,
                  t,
                  remote,
                  item,
                  checked: item.enabled,
                  onToggle: (next) => mutate({ op: 'setSessionOverride', sessionId, variableId: item.id, enabled: next }),
                  onDelete: () => mutate({ op: 'removeSessionVar', sessionId, id: item.id }),
                  onChanged: reload,
                  canDelete: item.source === 'session',
                  canEditValue: item.source === 'session',
                  toggleDisabled: item.source === 'auto',
                }))))),
        h('p', { style: S.notice }, t('notice.inherited')),
        h('p', { style: S.notice }, t('notice.values')))
    }

    // ---------------------------------------------------------------- icons
    function Icon({ size }) {
      return h('svg', { viewBox: '0 0 64 64', width: size ?? 16, height: size ?? 16, 'aria-hidden': true, style: { display: 'block' } },
        h('circle', { cx: 26, cy: 28, r: 10, fill: 'none', stroke: 'currentColor', strokeWidth: 5 }),
        h('path', { d: 'M33 35 47 49', fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' }),
        h('path', { d: 'M41 43l5-5M46 48l5-5', fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' }))
    }

    function SessionView(props) {
      const sessionId = props.sessionId
      if (sessionId === undefined) return h('div', { style: S.page }, 'No session')
      return h(SessionPanel, { ...props, sessionId })
    }

    const plugin = {
      inject: ['slots', 'locale', 'contextMenus', 'remote', 'remote.credentials'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, STRINGS), 'secret-variables: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'secret-variables',
          order: 20,
          locale: NS,
          label: () => t('panel.title'),
        }, Icon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'secret-variables',
          locale: NS,
          inject: () => ({ t, remote: ctx.remote }),
        }, GlobalPanel))

        ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view',
          id: 'secret-variables',
          order: 20,
          locale: NS,
          label: () => t('view.title'),
          inject: () => ({ t, remote: ctx.remote }),
        }, SessionView))

        const workspaceDialog = createStore({ open: false, workspaceId: null, title: '' })
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'secret-variables.workspace',
          order: 500,
          locale: NS,
          inject: () => ({ t, remote: ctx.remote, dialog: workspaceDialog }),
        }, WorkspaceDialog))

        ctx.effect(() => ctx.contextMenus.register({
          id: 'secret-variables.workspace',
          target: 'workspace',
          order: 200,
          resolve: (target) => [{
            id: 'secret-variables',
            label: t('panel.title'),
            icon: { key: 'secret-variables' },
            run: () => workspaceDialog.set({ open: true, workspaceId: target.workspaceId, title: target.displayTitle }),
          }],
        }), 'secret-variables: workspace menu')

        ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
          name: 'contextMenu.icon',
          key: 'secret-variables',
        }, Icon))
      },
    }

    return plugin
  },
})
