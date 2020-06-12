# Pyes Docs
Full documentation for pyes is available at https://hedgeproject.org/pyes

## Quickstart

### Summary
Pyes is a desktop application for reprogramming embedded devices. It stands for program-your-embedded-system. Its interface provides users with a catalog of programs, each with an icon. By clicking on these, a user can upload a selected program onto a device tethered via USB. Pyes can update its program catalog from a remote repository on github.

Pyes is provided as an application template that can be configured and modified; once filled in, the template produces an application and installer for windows, mac, and linux.

### Source Repository
The source code for pyes can be found at: https://www.github.com/simzes/pyes. Application instances should base their modifications on this git repository.

### Important Components

- Desktop Interface

    The desktop interface provides the user with a view of the program catalog, where each program has an icon and title. When a program is selected, additional information is displayed in a sidebar, and the user can click upload to flash a connected device with this program.


    This component is written in vue, and communicates with the application main process.

- Application Main

    The main process handles loading and presenting catalog contents, uploading programs onto the embedded device, and updating the catalog from a remote source. The interface process retrieves the catalog from the main, and sends back requests to upload selected programs.

- Program Catalog

    The catalog holds all embedded programs available to the user, and their associated resources. The catalog is described in an index file, which is in the catalog’s base directory. The index lists each program’s resources (icon, binary, title, etc.), as well as some details on its source and version.

### Important Files
<https://hedgeproject.org/pyes#important-files>

### Important Workflows
<https://hedgeproject.org/pyes#tasks-and-workflows>
