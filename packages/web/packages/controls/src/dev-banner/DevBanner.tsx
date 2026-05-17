'use client'

export type DevBannerPosition = 'fixed' | 'static'

export type DevBannerProps = {
  message?: string
  position?: DevBannerPosition
  className?: string
}

const DEFAULT_MESSAGE = 'Development Preview — Coming Soon!'

export function DevBanner({
  message = DEFAULT_MESSAGE,
  position = 'fixed',
  className,
}: DevBannerProps) {
  const cls = ['awt-dev-banner', `awt-dev-banner--${position}`, className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} aria-hidden="true">
      {message}
    </div>
  )
}
