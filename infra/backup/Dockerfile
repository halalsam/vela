FROM postgres:16-alpine
RUN apk add --no-cache rclone age
COPY backup.sh /usr/local/bin/vela-backup
RUN chmod 0755 /usr/local/bin/vela-backup
ENTRYPOINT ["vela-backup"]
CMD ["loop"]
