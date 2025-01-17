import { useState, useMemo, createContext, useEffect, useContext, ReactNode } from 'react'
import { createTheme, ThemeProvider, GlobalStyles, useMediaQuery, PaletteMode } from '@mui/material'
import { grey } from '@mui/material/colors'
import { activeColorModeStorageKey } from '../helpers/localStorageKeys'

declare module '@mui/material/styles' {
  interface Theme {
    isSmallScreen: boolean
  }
  interface ThemeOptions {
    isSmallScreen: boolean
  }
}

export const LIGHT_COLOR_MODE = 'light'
export const DARK_COLOR_MODE = 'dark'
export const SYSTEM_COLOR_MODE = 'system'

export type AppColorMode = PaletteMode | typeof SYSTEM_COLOR_MODE;

type ColorModeContextType = {
  colorMode: PaletteMode
  internalColorMode: AppColorMode,
  setColorMode: (newMode: AppColorMode) => void
}

export const ColorModeContext = createContext<ColorModeContextType>({
  colorMode: DARK_COLOR_MODE,
  internalColorMode: SYSTEM_COLOR_MODE,
  setColorMode: () => { }
})

export function MaterialThemeContextProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppColorMode>(
    (localStorage.getItem(activeColorModeStorageKey) as AppColorMode | null) ?? SYSTEM_COLOR_MODE
  )

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const isSmallScreen = useMediaQuery('screen and (max-width: 768px)')

  let activeColorMode: PaletteMode
  if (mode === SYSTEM_COLOR_MODE) {
    activeColorMode = prefersDarkMode ? DARK_COLOR_MODE : LIGHT_COLOR_MODE
  } else {
    activeColorMode = mode
  }

  const colorMode = useMemo(
    () => ({
      colorMode: activeColorMode,
      internalColorMode: mode,
      setColorMode: (newMode: AppColorMode) => setMode(newMode)
    }),
    [mode, activeColorMode]
  )

  useEffect(() => {
    localStorage.setItem(activeColorModeStorageKey, mode)
  }, [mode])

  const isLightMode = activeColorMode === LIGHT_COLOR_MODE
  const white = '#ffffff'
  const defaultBackgroundColor = isLightMode ? white : '#212121'

  const materialTheme = useMemo(() => createTheme({
    isSmallScreen,
    palette: {
      mode: activeColorMode,
      background: (isLightMode ? {} : { default: grey[800] }),
      primary: {
        main: isLightMode ? grey['700'] : grey['500']
      }
    },
    spacing: isSmallScreen ? 4 : 8,
    components: {
      MuiTypography: {
        styleOverrides: {
          body1: {
            fontSize: isSmallScreen ? '1rem' : undefined
          },
          body2: {
            fontSize: isSmallScreen ? '0.9rem' : undefined
          },
          h1: {
            fontSize: isSmallScreen ? '1.7rem' : undefined
          },
          h2: {
            fontSize: isSmallScreen ? '1.6rem' : undefined
          },
          h3: {
            fontSize: isSmallScreen ? '1.5rem' : undefined
          },
          h4: {
            fontSize: isSmallScreen ? '1.4rem' : undefined
          },
          h5: {
            fontSize: isSmallScreen ? '1.3rem' : undefined
          },
          h6: {
            fontSize: isSmallScreen ? '1.2rem' : undefined
          }
        }
      }
    }
  }), [isLightMode, activeColorMode, isSmallScreen])

  return (
    <>
      <GlobalStyles
        styles={{
          body: {
            backgroundColor: `${defaultBackgroundColor} !important`,
            colorScheme: activeColorMode
          },
          html: { colorScheme: activeColorMode }
        }}
      />
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={materialTheme}>
          {children}
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  )
}

export const useColorModeContext = () => useContext(ColorModeContext)
