/**
 * A DOM for the component tests.
 *
 * Registered globally rather than per file: happy-dom has to be in place before
 * React is imported anywhere, and a preload is the only point that is true for
 * every test file at once.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') {
  GlobalRegistrator.register({ url: 'http://localhost/' })
}
