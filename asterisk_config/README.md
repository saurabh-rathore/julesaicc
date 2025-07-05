# Asterisk Configuration Files

These are example configuration files for Asterisk. In a typical Asterisk installation (e.g., on Ubuntu from packages), these files would be located in `/etc/asterisk/`.

- `sip.conf`: Configures SIP peers, trunks, and global SIP settings.
- `extensions.conf`: Defines the dialplan, which controls call routing and application execution.
- `manager.conf`: Configures the Asterisk Manager Interface (AMI) for external application control.
- `http.conf`: Configures the built-in HTTP server in Asterisk (useful for ARI).
- `ari.conf`: Configures the Asterisk REST Interface (ARI).

**Deployment:**
These files should be copied or linked to the appropriate locations in your Asterisk server's configuration directory. Ensure that Asterisk is reloaded or restarted after changes.

**Example Reload Command (from Asterisk CLI):**
```
*CLI> core reload
```
or for specific modules:
```
*CLI> sip reload
*CLI> dialplan reload
*CLI> manager reload
```

**Security Note:**
The default credentials and settings in these example files are **NOT SECURE** and should be changed for any production environment. Specifically, change default passwords in `manager.conf` and restrict access where possible. Consider using TLS for SIP signaling and SRTP for media encryption.
