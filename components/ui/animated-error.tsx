"use client"

import { useEffect, useState } from "react"

type AnimatedErrorProps = {
  message?: string
  className?: string
  wrapperClassName?: string
}

const EXIT_DURATION_MS = 180

export function AnimatedError({ message, className = "", wrapperClassName = "" }: AnimatedErrorProps) {
  const [renderedMessage, setRenderedMessage] = useState(message ?? "")
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (message) {
      setRenderedMessage(message)
      setIsExiting(false)
      return
    }

    if (!renderedMessage) return
    setIsExiting(true)
    const timeout = window.setTimeout(() => {
      setRenderedMessage("")
      setIsExiting(false)
    }, EXIT_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [message, renderedMessage])

  return (
    <div
      aria-live="polite"
      className={`${renderedMessage ? "max-h-20 opacity-100" : "max-h-0 opacity-0"} overflow-hidden transition-all duration-200 ease-out ${wrapperClassName}`.trim()}
    >
      {renderedMessage ? (
        <p className={`${isExiting ? "error-pop-out" : "error-pop"} ${className}`.trim()}>
          {renderedMessage}
        </p>
      ) : null}
    </div>
  )
}
