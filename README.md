# Android notes

Capacitor's generated Android project is created in GitHub Actions. If you later create it locally, check Camera plugin permissions and target SDK behavior on a real device.

This initial build requests the rear camera through the Capacitor Camera plugin. The plugin may open Android's camera capture UI rather than a custom in-app live preview. A true live viewfinder with manual lens switching can be a later native-camera task.
