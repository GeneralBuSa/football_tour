// Boş/giriş gerektiren/hata durumları için ortak blok: ne olduğunu açıklar ve
// kullanıcıya bir sonraki adımı gösterir.
export default function EmptyState({ icon = 'ℹ️', message, actionLabel, actionHref, onAction, tone = 'neutral' }) {
  return (
    <div className={`empty-state ${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <p>{message}</p>
      {actionLabel && actionHref && <a className="mbtn mbtn-buy empty-state-action" href={actionHref}>{actionLabel}</a>}
      {actionLabel && onAction && !actionHref && (
        <button type="button" className="mbtn mbtn-buy empty-state-action" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
