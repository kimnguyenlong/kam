# syntax=docker/dockerfile:1

# ---- dev stage (hot reload via air) ----
# Source is bind-mounted at runtime (see docker-compose.dev.yml); air rebuilds
# and restarts ./cmd/server on every change. Module cache lives on a named
# volume so rebuilds stay fast.
FROM golang:1.25-alpine AS dev
WORKDIR /src
RUN go install github.com/air-verse/air@latest
COPY go.mod go.sum ./
RUN go mod download
COPY . .
EXPOSE 8080
ENTRYPOINT ["air", "-c", ".air.toml"]

# ---- build stage ----
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/kam ./cmd/server

# ---- runtime stage ----
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/kam /kam
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/kam"]
