// src/renderer/src/components/layout/TopNav.tsx
import { type ReactElement } from 'react'
import styles from './TopNav.module.css'

type TopNavProps = {
    user: AuthUser
    title: string
    // ✅ description eliminado
    showUserSummary: boolean
}

function BellIcon(): ReactElement {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    )
}

// function SettingsIcon(): ReactElement {
//     return (
//         <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
//             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//             <circle cx="12" cy="12" r="3" />
//             <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
//         </svg>
//     )
// }

export default function TopNav({
    title,
}: TopNavProps): ReactElement {
    return (
        <header className={styles.topNav}>

            {/* ─── Izquierda: título + breadcrumb ─────────────────── */}
            <div className={styles.titleBlock}>
                <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                    <span className={styles.breadcrumbRoot}>Inicio</span>
                    <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
                    <span className={styles.breadcrumbCurrent} aria-current="page">{title}</span>
                </nav>
                <h1 className={styles.title}>{title}</h1>
            </div>

            {/* ─── Derecha: acciones — siempre visibles ────────────── */}
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.actionButton}
                    aria-label="Notificaciones"
                    title="Notificaciones"
                >
                    <BellIcon />
                </button>

                {/* <button
                    type="button"
                    className={styles.actionButton}
                    aria-label="Configuración"
                    title="Configuración"
                >
                    <SettingsIcon />
                </button> */}
            </div>
        </header>
    )
}
