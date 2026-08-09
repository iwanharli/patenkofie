package auth

import (
	"context"
	"errors"
	"net/http"
)

const RoleOwner = "OWNER"

// Actor is the authenticated user behind the current request, resolved once by
// RequireAuth and shared with handlers through the request context.
type Actor struct {
	UserID   int64
	Username string
	Role     string
}

func (actor Actor) IsOwner() bool {
	return actor.Role == RoleOwner
}

type contextKey struct{}

var actorContextKey contextKey

// ActorFrom returns the actor stored by RequireAuth. It reports false when the
// request did not pass through RequireAuth.
func ActorFrom(ctx context.Context) (Actor, bool) {
	actor, ok := ctx.Value(actorContextKey).(Actor)
	return actor, ok
}

// RequireAuth rejects requests without a valid session and re-reads the user on
// every request, so accounts that are deactivated or have their role changed
// mid-session lose access immediately instead of at session expiry.
func RequireAuth(sessionStore *SessionStore, repo *Repository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
				return
			}

			session, ok := sessionStore.Get(cookie.Value)
			if !ok || session.UserID == 0 {
				writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
				return
			}

			user, err := repo.FindActiveUserByID(r.Context(), session.UserID)
			if errors.Is(err, ErrUserNotFound) {
				sessionStore.Delete(cookie.Value)
				writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
				return
			}
			if err != nil {
				writeError(w, http.StatusInternalServerError, "SESSION_CHECK_FAILED", "Sesi pengguna gagal diperiksa")
				return
			}

			actor := Actor{UserID: user.ID, Username: user.Username, Role: user.Role}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), actorContextKey, actor)))
		})
	}
}

// RequireOwner guards routes that only the shop owner may reach. It must be
// mounted behind RequireAuth.
func RequireOwner(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		actor, ok := ActorFrom(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
			return
		}
		if !actor.IsOwner() {
			writeError(w, http.StatusForbidden, "OWNER_ONLY", "Hanya OWNER yang dapat mengakses fitur ini")
			return
		}

		next.ServeHTTP(w, r)
	})
}
