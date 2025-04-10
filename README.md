# Flikk Backend

yeah so this really sucks, thought i'd never have to make this code public but here we are, creative commons this up

you do NOT want to use this, this was 100% for internal use and the codebase is literally genuinely in every sense possible the worst javascript i've ever written in my life

## Setup

Most things you'll figure out by failing to run `run.bat` but basically

1. `git clone`, `npm i` ykyk
1. Run `run.bat` with `--generate` to generate the needed files
1. Add a valid ssl certificate to ./ssl/cert.pem and ./ssl/key.pem
1. Don't remove the .git folder to allow it to fetch the current git hash
1. Run `run.bat` with `--port <port_number> --ipOctet3 <ip octet 3> --ipOctet4 <ip octet 4>`, where ipOctet3/4 are the third and fourth numbers of the server's local ip address (i.e `192.168.ipOctet3.ipOctet4`)
1. Probably another thing I've forgotten
