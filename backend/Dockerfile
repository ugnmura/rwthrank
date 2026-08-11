# PocketBase uses a pure-Go SQLite driver, so this builds a static binary and
# the runtime stage needs nothing but certificates.
FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/rwthrank .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates wget && adduser -D -u 10001 app

WORKDIR /pb
COPY --from=build /out/rwthrank /pb/rwthrank

# /pb/pb_data matches the other PocketBase stacks on the box, so the bind mount
# in deploy/rwthrank/docker-compose.yaml is the same shape as midimc's.
RUN mkdir -p /pb/pb_data && chown -R app:app /pb
USER app

EXPOSE 8090

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1

# 0.0.0.0 rather than the default 127.0.0.1, otherwise the port publish is dead.
ENTRYPOINT ["/pb/rwthrank"]
CMD ["serve", "--http=0.0.0.0:8090"]
