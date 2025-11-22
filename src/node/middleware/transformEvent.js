/**
 * Middleware to transform event data from frontend format to backend format
 */
export const transformEventData = (req, res, next) => {
  try {
    if (req.body.location) {
      // Transform coordinates from {latitude, longitude} to [longitude, latitude]
      if (req.body.location.coordinates) {
        const coords = req.body.location.coordinates;

        // If coordinates is an object with latitude/longitude
        if (coords.latitude !== undefined && coords.longitude !== undefined) {
          req.body.location.coordinates = [coords.longitude, coords.latitude];
        }
        // If coordinates is a string (JSON string), parse it
        else if (typeof coords === "string") {
          try {
            const parsed = JSON.parse(coords);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const first = parsed[0];
              if (
                first.latitude !== undefined &&
                first.longitude !== undefined
              ) {
                req.body.location.coordinates = [
                  first.longitude,
                  first.latitude,
                ];
              }
            }
          } catch (e) {
            // If parsing fails, leave as is and let validation handle it
          }
        }
      }

      // Transform address from string to object
      if (
        req.body.location.address &&
        typeof req.body.location.address === "string"
      ) {
        // If address is a simple string, convert to object with street field
        req.body.location.address = {
          street: req.body.location.address,
          city: req.body.location.city || "",
          state: req.body.location.state || "",
          country: req.body.location.country || "",
          zipCode: req.body.location.zipCode || "",
        };
      }

      // If city, state, country are at location level, move them to address
      if (req.body.location.city && req.body.location.address) {
        req.body.location.address.city =
          req.body.location.address.city || req.body.location.city;
        req.body.location.address.state =
          req.body.location.address.state || req.body.location.state;
        req.body.location.address.country =
          req.body.location.address.country || req.body.location.country;
        req.body.location.address.zipCode =
          req.body.location.address.zipCode || req.body.location.zipCode;

        // Clean up location level fields
        delete req.body.location.city;
        delete req.body.location.state;
        delete req.body.location.country;
        delete req.body.location.zipCode;
      }
    }

    next();
  } catch (error) {
    console.error("Error transforming event data:", error);
    next(); // Continue even if transformation fails, let validation handle it
  }
};
