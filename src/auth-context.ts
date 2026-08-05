import { createContext, useContext } from 'react'

export type TeamRole = 'admin' | 'editor' | 'member'

export type TeamIdentity = {
  userId: string
  email: string
  displayName: string
  role: TeamRole
}

export type AuthContextValue = {
  identity: TeamIdentity | null
  canEdit: boolean
  canAdmin: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  identity: null,
  canEdit: true,
  canAdmin: true,
  signOut: async () => undefined,
})

export function useTeamAuth() {
  return useContext(AuthContext)
}
