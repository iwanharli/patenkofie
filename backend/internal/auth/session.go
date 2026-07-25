package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"
)

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]Session
	ttl      time.Duration
}

func NewSessionStore(ttl time.Duration) *SessionStore {
	return &SessionStore{
		sessions: make(map[string]Session),
		ttl:      ttl,
	}
}

func (store *SessionStore) Create(userID int64) (Session, error) {
	token, err := randomToken(32)
	if err != nil {
		return Session{}, err
	}

	session := Session{
		Token:     token,
		UserID:    userID,
		ExpiresAt: time.Now().Add(store.ttl),
	}

	store.mu.Lock()
	store.sessions[token] = session
	store.mu.Unlock()

	return session, nil
}

func (store *SessionStore) Get(token string) (Session, bool) {
	store.mu.RLock()
	session, ok := store.sessions[token]
	store.mu.RUnlock()

	if !ok || time.Now().After(session.ExpiresAt) {
		if ok {
			store.Delete(token)
		}
		return Session{}, false
	}

	return session, true
}

func (store *SessionStore) Delete(token string) {
	store.mu.Lock()
	delete(store.sessions, token)
	store.mu.Unlock()
}

func randomToken(byteLength int) (string, error) {
	bytes := make([]byte, byteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
