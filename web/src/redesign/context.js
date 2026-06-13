import { createContext, useContext } from 'react'

// Shared context carrying the app model + handlers to the redesigned views,
// so leaf components (EventRow, ChannelCard, …) don't need deep prop drilling.
export const App832Context = createContext(null)
export const useApp832 = () => useContext(App832Context)
