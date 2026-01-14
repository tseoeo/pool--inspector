// Target jurisdictions for coverage tracking
// Based on population - top cities and counties per state
// These represent the jurisdictions we want to collect pool inspection data from

export interface TargetJurisdictionData {
  state: string;
  name: string;
  type: "CITY" | "COUNTY" | "HEALTH_DISTRICT";
  priority?: number; // Higher = more important (based on population)
}

export const TARGET_JURISDICTIONS: TargetJurisdictionData[] = [
  // Alabama (pop: 5M)
  { state: "AL", name: "Birmingham", type: "CITY", priority: 5 },
  { state: "AL", name: "Montgomery", type: "CITY", priority: 4 },
  { state: "AL", name: "Huntsville", type: "CITY", priority: 4 },
  { state: "AL", name: "Mobile", type: "CITY", priority: 4 },
  { state: "AL", name: "Jefferson County", type: "COUNTY", priority: 3 },

  // Alaska (pop: 730K)
  { state: "AK", name: "Anchorage", type: "CITY", priority: 5 },
  { state: "AK", name: "Fairbanks", type: "CITY", priority: 3 },
  { state: "AK", name: "Juneau", type: "CITY", priority: 3 },

  // Arizona (pop: 7.3M)
  { state: "AZ", name: "Phoenix", type: "CITY", priority: 5 },
  { state: "AZ", name: "Tucson", type: "CITY", priority: 5 },
  { state: "AZ", name: "Mesa", type: "CITY", priority: 4 },
  { state: "AZ", name: "Maricopa County", type: "COUNTY", priority: 5 },
  { state: "AZ", name: "Pima County", type: "COUNTY", priority: 4 },
  { state: "AZ", name: "Scottsdale", type: "CITY", priority: 4 },

  // Arkansas (pop: 3M)
  { state: "AR", name: "Little Rock", type: "CITY", priority: 5 },
  { state: "AR", name: "Fort Smith", type: "CITY", priority: 3 },
  { state: "AR", name: "Fayetteville", type: "CITY", priority: 3 },
  { state: "AR", name: "Pulaski County", type: "COUNTY", priority: 4 },

  // California (pop: 39M)
  { state: "CA", name: "Los Angeles County", type: "COUNTY", priority: 5 },
  { state: "CA", name: "San Diego County", type: "COUNTY", priority: 5 },
  { state: "CA", name: "Orange County", type: "COUNTY", priority: 5 },
  { state: "CA", name: "Riverside County", type: "COUNTY", priority: 5 },
  { state: "CA", name: "San Bernardino County", type: "COUNTY", priority: 5 },
  { state: "CA", name: "Santa Clara County", type: "COUNTY", priority: 5 },
  { state: "CA", name: "Alameda County", type: "COUNTY", priority: 4 },
  { state: "CA", name: "Sacramento County", type: "COUNTY", priority: 4 },
  { state: "CA", name: "San Francisco", type: "CITY", priority: 5 },
  { state: "CA", name: "Fresno County", type: "COUNTY", priority: 4 },

  // Colorado (pop: 5.8M)
  { state: "CO", name: "Denver", type: "CITY", priority: 5 },
  { state: "CO", name: "Colorado Springs", type: "CITY", priority: 4 },
  { state: "CO", name: "Aurora", type: "CITY", priority: 4 },
  { state: "CO", name: "El Paso County", type: "COUNTY", priority: 4 },
  { state: "CO", name: "Arapahoe County", type: "COUNTY", priority: 4 },
  { state: "CO", name: "Jefferson County", type: "COUNTY", priority: 4 },

  // Connecticut (pop: 3.6M)
  { state: "CT", name: "Bridgeport", type: "CITY", priority: 4 },
  { state: "CT", name: "New Haven", type: "CITY", priority: 4 },
  { state: "CT", name: "Hartford", type: "CITY", priority: 4 },
  { state: "CT", name: "Stamford", type: "CITY", priority: 4 },
  { state: "CT", name: "Fairfield County", type: "COUNTY", priority: 5 },

  // Delaware (pop: 1M)
  { state: "DE", name: "Wilmington", type: "CITY", priority: 5 },
  { state: "DE", name: "Dover", type: "CITY", priority: 4 },
  { state: "DE", name: "New Castle County", type: "COUNTY", priority: 5 },

  // Florida (pop: 22M)
  { state: "FL", name: "Miami-Dade County", type: "COUNTY", priority: 5 },
  { state: "FL", name: "Broward County", type: "COUNTY", priority: 5 },
  { state: "FL", name: "Palm Beach County", type: "COUNTY", priority: 5 },
  { state: "FL", name: "Hillsborough County", type: "COUNTY", priority: 5 },
  { state: "FL", name: "Orange County", type: "COUNTY", priority: 5 },
  { state: "FL", name: "Pinellas County", type: "COUNTY", priority: 4 },
  { state: "FL", name: "Duval County", type: "COUNTY", priority: 4 },
  { state: "FL", name: "Lee County", type: "COUNTY", priority: 4 },

  // Georgia (pop: 10.8M)
  { state: "GA", name: "Atlanta", type: "CITY", priority: 5 },
  { state: "GA", name: "Fulton County", type: "COUNTY", priority: 5 },
  { state: "GA", name: "Gwinnett County", type: "COUNTY", priority: 5 },
  { state: "GA", name: "Cobb County", type: "COUNTY", priority: 4 },
  { state: "GA", name: "DeKalb County", type: "COUNTY", priority: 4 },
  { state: "GA", name: "Savannah", type: "CITY", priority: 4 },

  // Hawaii (pop: 1.4M)
  { state: "HI", name: "Honolulu", type: "CITY", priority: 5 },
  { state: "HI", name: "Maui County", type: "COUNTY", priority: 4 },
  { state: "HI", name: "Hawaii County", type: "COUNTY", priority: 3 },

  // Idaho (pop: 1.9M)
  { state: "ID", name: "Boise", type: "CITY", priority: 5 },
  { state: "ID", name: "Meridian", type: "CITY", priority: 4 },
  { state: "ID", name: "Ada County", type: "COUNTY", priority: 5 },
  { state: "ID", name: "Canyon County", type: "COUNTY", priority: 4 },

  // Illinois (pop: 12.6M)
  { state: "IL", name: "Chicago", type: "CITY", priority: 5 },
  { state: "IL", name: "Cook County", type: "COUNTY", priority: 5 },
  { state: "IL", name: "DuPage County", type: "COUNTY", priority: 4 },
  { state: "IL", name: "Lake County", type: "COUNTY", priority: 4 },
  { state: "IL", name: "Will County", type: "COUNTY", priority: 4 },
  { state: "IL", name: "Kane County", type: "COUNTY", priority: 3 },

  // Indiana (pop: 6.8M)
  { state: "IN", name: "Indianapolis", type: "CITY", priority: 5 },
  { state: "IN", name: "Fort Wayne", type: "CITY", priority: 4 },
  { state: "IN", name: "Evansville", type: "CITY", priority: 3 },
  { state: "IN", name: "Marion County", type: "COUNTY", priority: 5 },
  { state: "IN", name: "Lake County", type: "COUNTY", priority: 4 },

  // Iowa (pop: 3.2M)
  { state: "IA", name: "Des Moines", type: "CITY", priority: 5 },
  { state: "IA", name: "Cedar Rapids", type: "CITY", priority: 4 },
  { state: "IA", name: "Davenport", type: "CITY", priority: 3 },
  { state: "IA", name: "Polk County", type: "COUNTY", priority: 5 },

  // Kansas (pop: 2.9M)
  { state: "KS", name: "Wichita", type: "CITY", priority: 5 },
  { state: "KS", name: "Overland Park", type: "CITY", priority: 4 },
  { state: "KS", name: "Kansas City", type: "CITY", priority: 4 },
  { state: "KS", name: "Johnson County", type: "COUNTY", priority: 5 },
  { state: "KS", name: "Sedgwick County", type: "COUNTY", priority: 4 },

  // Kentucky (pop: 4.5M)
  { state: "KY", name: "Louisville", type: "CITY", priority: 5 },
  { state: "KY", name: "Lexington", type: "CITY", priority: 5 },
  { state: "KY", name: "Jefferson County", type: "COUNTY", priority: 5 },
  { state: "KY", name: "Fayette County", type: "COUNTY", priority: 4 },

  // Louisiana (pop: 4.6M)
  { state: "LA", name: "New Orleans", type: "CITY", priority: 5 },
  { state: "LA", name: "Baton Rouge", type: "CITY", priority: 5 },
  { state: "LA", name: "Shreveport", type: "CITY", priority: 4 },
  { state: "LA", name: "Jefferson Parish", type: "COUNTY", priority: 4 },
  { state: "LA", name: "East Baton Rouge Parish", type: "COUNTY", priority: 4 },

  // Maine (pop: 1.4M)
  { state: "ME", name: "Portland", type: "CITY", priority: 5 },
  { state: "ME", name: "Lewiston", type: "CITY", priority: 3 },
  { state: "ME", name: "Cumberland County", type: "COUNTY", priority: 5 },

  // Maryland (pop: 6.2M)
  { state: "MD", name: "Baltimore", type: "CITY", priority: 5 },
  { state: "MD", name: "Montgomery County", type: "COUNTY", priority: 5 },
  { state: "MD", name: "Prince George's County", type: "COUNTY", priority: 5 },
  { state: "MD", name: "Anne Arundel County", type: "COUNTY", priority: 4 },
  { state: "MD", name: "Baltimore County", type: "COUNTY", priority: 4 },
  { state: "MD", name: "Howard County", type: "COUNTY", priority: 4 },

  // Massachusetts (pop: 7M)
  { state: "MA", name: "Boston", type: "CITY", priority: 5 },
  { state: "MA", name: "Worcester", type: "CITY", priority: 4 },
  { state: "MA", name: "Springfield", type: "CITY", priority: 4 },
  { state: "MA", name: "Middlesex County", type: "COUNTY", priority: 5 },
  { state: "MA", name: "Suffolk County", type: "COUNTY", priority: 5 },

  // Michigan (pop: 10M)
  { state: "MI", name: "Detroit", type: "CITY", priority: 5 },
  { state: "MI", name: "Grand Rapids", type: "CITY", priority: 4 },
  { state: "MI", name: "Wayne County", type: "COUNTY", priority: 5 },
  { state: "MI", name: "Oakland County", type: "COUNTY", priority: 5 },
  { state: "MI", name: "Macomb County", type: "COUNTY", priority: 4 },
  { state: "MI", name: "Kent County", type: "COUNTY", priority: 4 },

  // Minnesota (pop: 5.7M)
  { state: "MN", name: "Minneapolis", type: "CITY", priority: 5 },
  { state: "MN", name: "Saint Paul", type: "CITY", priority: 5 },
  { state: "MN", name: "Hennepin County", type: "COUNTY", priority: 5 },
  { state: "MN", name: "Ramsey County", type: "COUNTY", priority: 4 },
  { state: "MN", name: "Dakota County", type: "COUNTY", priority: 4 },

  // Mississippi (pop: 3M)
  { state: "MS", name: "Jackson", type: "CITY", priority: 5 },
  { state: "MS", name: "Gulfport", type: "CITY", priority: 4 },
  { state: "MS", name: "Hinds County", type: "COUNTY", priority: 5 },
  { state: "MS", name: "Harrison County", type: "COUNTY", priority: 4 },

  // Missouri (pop: 6.2M)
  { state: "MO", name: "Kansas City", type: "CITY", priority: 5 },
  { state: "MO", name: "Saint Louis", type: "CITY", priority: 5 },
  { state: "MO", name: "Springfield", type: "CITY", priority: 4 },
  { state: "MO", name: "St. Louis County", type: "COUNTY", priority: 5 },
  { state: "MO", name: "Jackson County", type: "COUNTY", priority: 4 },

  // Montana (pop: 1.1M)
  { state: "MT", name: "Billings", type: "CITY", priority: 5 },
  { state: "MT", name: "Missoula", type: "CITY", priority: 4 },
  { state: "MT", name: "Great Falls", type: "CITY", priority: 3 },
  { state: "MT", name: "Yellowstone County", type: "COUNTY", priority: 5 },

  // Nebraska (pop: 2M)
  { state: "NE", name: "Omaha", type: "CITY", priority: 5 },
  { state: "NE", name: "Lincoln", type: "CITY", priority: 5 },
  { state: "NE", name: "Douglas County", type: "COUNTY", priority: 5 },
  { state: "NE", name: "Lancaster County", type: "COUNTY", priority: 4 },

  // Nevada (pop: 3.1M)
  { state: "NV", name: "Las Vegas", type: "CITY", priority: 5 },
  { state: "NV", name: "Henderson", type: "CITY", priority: 4 },
  { state: "NV", name: "Reno", type: "CITY", priority: 4 },
  { state: "NV", name: "Clark County", type: "COUNTY", priority: 5 },
  { state: "NV", name: "Washoe County", type: "COUNTY", priority: 4 },

  // New Hampshire (pop: 1.4M)
  { state: "NH", name: "Manchester", type: "CITY", priority: 5 },
  { state: "NH", name: "Nashua", type: "CITY", priority: 4 },
  { state: "NH", name: "Hillsborough County", type: "COUNTY", priority: 5 },

  // New Jersey (pop: 9.3M)
  { state: "NJ", name: "Newark", type: "CITY", priority: 5 },
  { state: "NJ", name: "Jersey City", type: "CITY", priority: 5 },
  { state: "NJ", name: "Bergen County", type: "COUNTY", priority: 5 },
  { state: "NJ", name: "Middlesex County", type: "COUNTY", priority: 5 },
  { state: "NJ", name: "Essex County", type: "COUNTY", priority: 5 },
  { state: "NJ", name: "Hudson County", type: "COUNTY", priority: 4 },
  { state: "NJ", name: "Monmouth County", type: "COUNTY", priority: 4 },

  // New Mexico (pop: 2.1M)
  { state: "NM", name: "Albuquerque", type: "CITY", priority: 5 },
  { state: "NM", name: "Las Cruces", type: "CITY", priority: 4 },
  { state: "NM", name: "Santa Fe", type: "CITY", priority: 4 },
  { state: "NM", name: "Bernalillo County", type: "COUNTY", priority: 5 },

  // New York (pop: 19.5M)
  { state: "NY", name: "New York City", type: "CITY", priority: 5 },
  { state: "NY", name: "Buffalo", type: "CITY", priority: 4 },
  { state: "NY", name: "Rochester", type: "CITY", priority: 4 },
  { state: "NY", name: "Nassau County", type: "COUNTY", priority: 5 },
  { state: "NY", name: "Suffolk County", type: "COUNTY", priority: 5 },
  { state: "NY", name: "Westchester County", type: "COUNTY", priority: 5 },
  { state: "NY", name: "Erie County", type: "COUNTY", priority: 4 },

  // North Carolina (pop: 10.5M)
  { state: "NC", name: "Charlotte", type: "CITY", priority: 5 },
  { state: "NC", name: "Raleigh", type: "CITY", priority: 5 },
  { state: "NC", name: "Greensboro", type: "CITY", priority: 4 },
  { state: "NC", name: "Mecklenburg County", type: "COUNTY", priority: 5 },
  { state: "NC", name: "Wake County", type: "COUNTY", priority: 5 },
  { state: "NC", name: "Guilford County", type: "COUNTY", priority: 4 },

  // North Dakota (pop: 780K)
  { state: "ND", name: "Fargo", type: "CITY", priority: 5 },
  { state: "ND", name: "Bismarck", type: "CITY", priority: 4 },
  { state: "ND", name: "Cass County", type: "COUNTY", priority: 5 },

  // Ohio (pop: 11.8M)
  { state: "OH", name: "Columbus", type: "CITY", priority: 5 },
  { state: "OH", name: "Cleveland", type: "CITY", priority: 5 },
  { state: "OH", name: "Cincinnati", type: "CITY", priority: 5 },
  { state: "OH", name: "Franklin County", type: "COUNTY", priority: 5 },
  { state: "OH", name: "Cuyahoga County", type: "COUNTY", priority: 5 },
  { state: "OH", name: "Hamilton County", type: "COUNTY", priority: 4 },

  // Oklahoma (pop: 4M)
  { state: "OK", name: "Oklahoma City", type: "CITY", priority: 5 },
  { state: "OK", name: "Tulsa", type: "CITY", priority: 5 },
  { state: "OK", name: "Oklahoma County", type: "COUNTY", priority: 5 },
  { state: "OK", name: "Tulsa County", type: "COUNTY", priority: 4 },

  // Oregon (pop: 4.2M)
  { state: "OR", name: "Portland", type: "CITY", priority: 5 },
  { state: "OR", name: "Salem", type: "CITY", priority: 4 },
  { state: "OR", name: "Eugene", type: "CITY", priority: 4 },
  { state: "OR", name: "Multnomah County", type: "COUNTY", priority: 5 },
  { state: "OR", name: "Washington County", type: "COUNTY", priority: 4 },

  // Pennsylvania (pop: 13M)
  { state: "PA", name: "Philadelphia", type: "CITY", priority: 5 },
  { state: "PA", name: "Pittsburgh", type: "CITY", priority: 5 },
  { state: "PA", name: "Allegheny County", type: "COUNTY", priority: 5 },
  { state: "PA", name: "Montgomery County", type: "COUNTY", priority: 5 },
  { state: "PA", name: "Bucks County", type: "COUNTY", priority: 4 },
  { state: "PA", name: "Delaware County", type: "COUNTY", priority: 4 },

  // Rhode Island (pop: 1.1M)
  { state: "RI", name: "Providence", type: "CITY", priority: 5 },
  { state: "RI", name: "Warwick", type: "CITY", priority: 4 },
  { state: "RI", name: "Providence County", type: "COUNTY", priority: 5 },

  // South Carolina (pop: 5.2M)
  { state: "SC", name: "Charleston", type: "CITY", priority: 5 },
  { state: "SC", name: "Columbia", type: "CITY", priority: 5 },
  { state: "SC", name: "Greenville", type: "CITY", priority: 4 },
  { state: "SC", name: "Greenville County", type: "COUNTY", priority: 4 },
  { state: "SC", name: "Richland County", type: "COUNTY", priority: 4 },

  // South Dakota (pop: 900K)
  { state: "SD", name: "Sioux Falls", type: "CITY", priority: 5 },
  { state: "SD", name: "Rapid City", type: "CITY", priority: 4 },
  { state: "SD", name: "Minnehaha County", type: "COUNTY", priority: 5 },

  // Tennessee (pop: 7M)
  { state: "TN", name: "Nashville", type: "CITY", priority: 5 },
  { state: "TN", name: "Memphis", type: "CITY", priority: 5 },
  { state: "TN", name: "Knoxville", type: "CITY", priority: 4 },
  { state: "TN", name: "Davidson County", type: "COUNTY", priority: 5 },
  { state: "TN", name: "Shelby County", type: "COUNTY", priority: 5 },
  { state: "TN", name: "Knox County", type: "COUNTY", priority: 4 },

  // Texas (pop: 30M)
  { state: "TX", name: "Houston", type: "CITY", priority: 5 },
  { state: "TX", name: "San Antonio", type: "CITY", priority: 5 },
  { state: "TX", name: "Dallas", type: "CITY", priority: 5 },
  { state: "TX", name: "Austin", type: "CITY", priority: 5 },
  { state: "TX", name: "Fort Worth", type: "CITY", priority: 5 },
  { state: "TX", name: "El Paso", type: "CITY", priority: 4 },
  { state: "TX", name: "Harris County", type: "COUNTY", priority: 5 },
  { state: "TX", name: "Dallas County", type: "COUNTY", priority: 5 },
  { state: "TX", name: "Tarrant County", type: "COUNTY", priority: 5 },
  { state: "TX", name: "Bexar County", type: "COUNTY", priority: 5 },
  { state: "TX", name: "Webster", type: "CITY", priority: 2 },

  // Utah (pop: 3.4M)
  { state: "UT", name: "Salt Lake City", type: "CITY", priority: 5 },
  { state: "UT", name: "West Valley City", type: "CITY", priority: 4 },
  { state: "UT", name: "Salt Lake County", type: "COUNTY", priority: 5 },
  { state: "UT", name: "Utah County", type: "COUNTY", priority: 4 },

  // Vermont (pop: 650K)
  { state: "VT", name: "Burlington", type: "CITY", priority: 5 },
  { state: "VT", name: "Chittenden County", type: "COUNTY", priority: 5 },

  // Virginia (pop: 8.6M)
  { state: "VA", name: "Virginia Beach", type: "CITY", priority: 5 },
  { state: "VA", name: "Norfolk", type: "CITY", priority: 4 },
  { state: "VA", name: "Chesapeake", type: "CITY", priority: 4 },
  { state: "VA", name: "Richmond", type: "CITY", priority: 5 },
  { state: "VA", name: "Fairfax County", type: "COUNTY", priority: 5 },
  { state: "VA", name: "Prince William County", type: "COUNTY", priority: 4 },

  // Washington (pop: 7.7M)
  { state: "WA", name: "Seattle", type: "CITY", priority: 5 },
  { state: "WA", name: "Spokane", type: "CITY", priority: 4 },
  { state: "WA", name: "Tacoma", type: "CITY", priority: 4 },
  { state: "WA", name: "King County", type: "COUNTY", priority: 5 },
  { state: "WA", name: "Pierce County", type: "COUNTY", priority: 4 },
  { state: "WA", name: "Snohomish County", type: "COUNTY", priority: 4 },

  // West Virginia (pop: 1.8M)
  { state: "WV", name: "Charleston", type: "CITY", priority: 5 },
  { state: "WV", name: "Huntington", type: "CITY", priority: 4 },
  { state: "WV", name: "Kanawha County", type: "COUNTY", priority: 5 },

  // Wisconsin (pop: 5.9M)
  { state: "WI", name: "Milwaukee", type: "CITY", priority: 5 },
  { state: "WI", name: "Madison", type: "CITY", priority: 5 },
  { state: "WI", name: "Green Bay", type: "CITY", priority: 4 },
  { state: "WI", name: "Milwaukee County", type: "COUNTY", priority: 5 },
  { state: "WI", name: "Dane County", type: "COUNTY", priority: 4 },

  // Wyoming (pop: 580K)
  { state: "WY", name: "Cheyenne", type: "CITY", priority: 5 },
  { state: "WY", name: "Casper", type: "CITY", priority: 4 },
  { state: "WY", name: "Laramie County", type: "COUNTY", priority: 5 },
];

// Get targets for a specific state
export function getTargetsForState(state: string): TargetJurisdictionData[] {
  return TARGET_JURISDICTIONS.filter((t) => t.state === state);
}

// Get count of targets per state
export function getTargetCountByState(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const target of TARGET_JURISDICTIONS) {
    counts[target.state] = (counts[target.state] || 0) + 1;
  }
  return counts;
}
