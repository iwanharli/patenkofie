package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Configure(appEnv string) {
	zerolog.TimeFieldFormat = time.RFC3339

	if appEnv == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.TimeOnly,
		})
		return
	}

	log.Logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
}
