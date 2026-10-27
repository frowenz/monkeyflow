import { useUi, type NotificationType } from "../store/ui";
import "../styles/notifications.css";

const ICONS: Record<NotificationType, string> = {
  notice: "fa-info-circle",
  success: "fa-check-circle",
  error: "fa-times-circle",
};

export function Notifications() {
  const notifications = useUi((s) => s.notifications);
  const focus = useUi((s) => s.focus);

  return (
    <div id="notificationCenter" aria-live="polite">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`notifWrap ${n.closing ? "closing" : ""} ${focus && n.type !== "error" ? "focusHidden" : ""}`}
        >
          <div className="notifClip">
            <div className={`notif ${n.type}`} role="status" onClick={() => useUi.getState().dismiss(n.id)}>
              <div className="notifContent">
                <div className="notifTitle">
                  <i className={`fas ${ICONS[n.type]}`} />
                  {n.title}
                </div>
                <div className="notifText">{n.text}</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
