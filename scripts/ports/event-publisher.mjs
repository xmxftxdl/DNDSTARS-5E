/** Runtime assertion for the server EventPublisher port. */
export function assertEventPublisherPort(value) {
  if (!value || typeof value.subscribe !== 'function' || typeof value.publish !== 'function' ||
    typeof value.publishBestEffort !== 'function') {
    throw new TypeError('invalid EventPublisher port')
  }
  return value
}
