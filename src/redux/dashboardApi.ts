import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
// import { WeatherSchema, CommuteAlertSchema, CalendarSchema, GamingSchema,
//          type WeatherData, type CommuteAlerts, type CalendarData, type GamingData } from "@/lib/api/schemas";

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: () => ({
    // getWeather: builder.query<WeatherData, void>({
    //   query: () => "weather",
    //   transformResponse: (response) => WeatherSchema.parse(response),
    //   keepUnusedDataFor: 300, // 5m
    //   pollingInterval: 30 * 60 * 1000, // 30m
    // }),
    // getCommute: b.query<CommuteAlerts, void>({
    //   query: () => "commute",
    //   transformResponse: (response) => CommuteAlertSchema.parse(response),
    //   keepUnusedDataFor: 300,
    //   pollingInterval: 15 * 60 * 1000, // 15m
    // }),
    // getCalendar: b.query<CalendarData, void>({
    //   query: () => "calendar",
    //   transformResponse: (response) => CalendarSchema.parse(response),
    //   keepUnusedDataFor: 1800, // 30m
    // }),
    // getGaming: b.query<GamingData, void>({
    //   query: () => "gaming",
    //   transformResponse: (response) => GamingSchema.parse(response),
    //   keepUnusedDataFor: 12 * 60 * 60, // 12h
    // }),
  }),
})

// export const {
//   //   useGetWeatherQuery,
//   //   useGetCommuteQuery,
//   //   useGetCalendarQuery,
//   //   useGetGamingQuery
// } = dashboardApi
