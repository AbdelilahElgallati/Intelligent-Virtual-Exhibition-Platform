from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.modules.favorites.schemas import FavoriteCreate, FavoriteRead
from app.modules.favorites.service import create_favorite, delete_favorite, list_favorites

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.get("/", response_model=list[FavoriteRead])
async def get_my_favorites(current_user: dict = Depends(get_current_user)) -> list[FavoriteRead]:
    favorites = await list_favorites(current_user["id"])
    return [FavoriteRead(**fav) for fav in favorites]


@router.post("/", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
async def add_favorite(data: FavoriteCreate, current_user: dict = Depends(get_current_user)) -> FavoriteRead:
    fav = await create_favorite(current_user["id"], data)
    return FavoriteRead(**fav)


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(favorite_id: str, current_user: dict = Depends(get_current_user)):
    deleted = await delete_favorite(favorite_id, current_user["id"])
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
    return None
