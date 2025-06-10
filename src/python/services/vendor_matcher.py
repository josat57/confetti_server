import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class VendorMatcher:
    def __init__(self):
        self.vendors = []

    def add_vendor(self, vendor_features):
        self.vendors.append(vendor_features)

    def match_vendors(self, event_features, top_n=5):
        # Placeholder for vendor matching logic
        # This is a simplified example; real implementation would be more complex
        event_features = np.array(event_features).reshape(1, -1)
        vendor_features = np.array(self.vendors)
        similarities = cosine_similarity(event_features, vendor_features)
        top_indices = similarities.argsort()[0][-top_n:][::-1]
        return [self.vendors[i] for i in top_indices] 