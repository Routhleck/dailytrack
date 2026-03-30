export type KalmanFilterOptions = {
  /** Process noise covariance - how much the true state changes between measurements */
  q?: number
  /** Measurement noise covariance - how noisy are the measurements */
  r?: number
  /** Initial state estimate */
  initialValue?: number
  /** Initial error covariance */
  initialP?: number
}

export type KalmanFilterResult = {
  /** Filtered/estimated value */
  estimatedValue: number
  /** Error covariance */
  variance: number
}

export type KalmanFilter = {
  filter: (measurement: number) => KalmanFilterResult
  reset: (value: number) => void
}

export function createKalmanFilter(options: KalmanFilterOptions = {}): KalmanFilter {
  const {
    q = 0.1,
    r = 1.0,
    initialValue = 0,
    initialP = 1.0,
  } = options

  let x = initialValue
  let p = initialP
  let initialized = false

  return {
    filter(measurement: number): KalmanFilterResult {
      if (!initialized) {
        x = measurement
        initialized = true
        return { estimatedValue: x, variance: p }
      }

      // Prediction step (no control input)
      const xPred = x
      const pPred = p + q

      // Update step
      const k = pPred / (pPred + r) // Kalman gain
      x = xPred + k * (measurement - xPred)
      p = (1 - k) * pPred

      return { estimatedValue: x, variance: p }
    },

    reset(value: number): void {
      x = value
      p = initialP
      initialized = true
    },
  }
}

export type MetricKalmanState = {
  filter: KalmanFilter
  lastEstimated: number | null
}

/**
 * Apply Kalman filter to a series of measurements (sorted by date, oldest first)
 */
export function applyKalmanFilterToSeries(
  measurements: (number | null)[],
  options: KalmanFilterOptions = {},
): (number | null)[] {
  const results: (number | null)[] = []
  const kalman = createKalmanFilter(options)

  for (const measurement of measurements) {
    if (measurement == null) {
      results.push(null)
      continue
    }
    const result = kalman.filter(measurement)
    results.push(result.estimatedValue)
  }

  return results
}
