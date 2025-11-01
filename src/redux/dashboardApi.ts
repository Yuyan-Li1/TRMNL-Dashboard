import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
// import { WeatherSchema, CommuteAlertSchema, CalendarSchema, GamingSchema,
//          type WeatherData, type CommuteAlerts, type CalendarData, type GamingData } from "@/lib/api/schemas";

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (b) => ({
    // getWeather: b.query<WeatherData, void>({
    //   query: () => "weather",
    //   transformResponse: (r) => WeatherSchema.parse(r),
    //   keepUnusedDataFor: 300, // 5m
    //   pollingInterval: 30 * 60 * 1000, // 30m
    // }),
    // getCommute: b.query<CommuteAlerts, void>({
    //   query: () => "commute",
    //   transformResponse: (r) => CommuteAlertSchema.parse(r),
    //   keepUnusedDataFor: 300,
    //   pollingInterval: 15 * 60 * 1000, // 15m
    // }),
    // getCalendar: b.query<CalendarData, void>({
    //   query: () => "calendar",
    //   transformResponse: (r) => CalendarSchema.parse(r),
    //   keepUnusedDataFor: 1800, // 30m
    // }),
    // getGaming: b.query<GamingData, void>({
    //   query: () => "gaming",
    //   transformResponse: (r) => GamingSchema.parse(r),
    //   keepUnusedDataFor: 12 * 60 * 60, // 12h
    // }),
  }),
});

export const {
//   useGetWeatherQuery,
//   useGetCommuteQuery,
//   useGetCalendarQuery,
//   useGetGamingQuery
} = dashboardApi;