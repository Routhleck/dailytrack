export type ReportPeriod = 'weekly' | 'monthly'

export type ReportProviderConfig = {
  providerName: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export type BuildReportInput = {
  period: ReportPeriod
  targetId: string
}

export type BuildReportResult = {
  reportPath: string
  reportMarkdown: string
}
