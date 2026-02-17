import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export type FavoriteTarget = 'event' | 'stand' | 'organization';

export interface Favorite {
  id: string;
  user_id: string;
  target_type: FavoriteTarget;
  target_id: string;
  created_at: string;
}

export const favoritesService = {
  list: () => apiClient.get<Favorite[]>(ENDPOINTS.FAVORITES.LIST),
  add: (target_type: FavoriteTarget, target_id: string) =>
    apiClient.post<Favorite>(ENDPOINTS.FAVORITES.ADD, { target_type, target_id }),
  remove: (favoriteId: string) => apiClient.delete<void>(ENDPOINTS.FAVORITES.DELETE(favoriteId)),
};
