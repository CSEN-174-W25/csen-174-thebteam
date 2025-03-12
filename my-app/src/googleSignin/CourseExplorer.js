import React, { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import "./CourseExplorer.css";

// Mode Toggle Component
const ModeToggle = ({ activeMode, onChange }) => {
    return (
        <div className="discord-mode-toggle">
            <span
                className={`discord-mode-label ${
                    activeMode === "catalog" ? "active" : ""
                }`}
            >
                Catalog View
            </span>
            <div
                className={`discord-toggle-switch ${
                    activeMode === "schedule" ? "schedule-active" : ""
                }`}
                onClick={() =>
                    onChange(activeMode === "catalog" ? "schedule" : "catalog")
                }
            >
                <div className="discord-toggle-handle"></div>
            </div>
            <span
                className={`discord-mode-label ${
                    activeMode === "schedule" ? "active" : ""
                }`}
            >
                Schedule View
            </span>
        </div>
    );
};

// Course Section Component
const CourseSection = ({ section, onSelect, isSelected }) => {
    return (
        <div
            className={`discord-section-item ${
                isSelected ? "discord-selected" : ""
            }`}
            onClick={() => onSelect(section)}
        >
            <div className="discord-section-header">
                <div className="discord-section-code">
                    {section["Course Section"] || "Unknown"}
                </div>
                <div className="discord-units">
                    {section["Units"] || ""} units
                </div>
            </div>

            <div className="discord-section-details">
                <div className="discord-section-time">
                    <span className="discord-detail-label">When:</span>
                    {section["Meeting Patterns"] || "TBA"}
                </div>

                <div className="discord-section-location">
                    <span className="discord-detail-label">Where:</span>
                    {section["Locations"] || "TBA"}
                </div>

                <div className="discord-section-instructor">
                    <span className="discord-detail-label">Instructor:</span>
                    <span className="discord-instructor-name">
                        {section["All Instructors"] || "TBA"}
                    </span>
                </div>

                {section["Course Tags"] && (
                    <div className="discord-section-tags">
                        <span className="discord-detail-label">Tags:</span>
                        <span className="discord-tags">
                            {section["Course Tags"]}
                        </span>
                    </div>
                )}

                {section["Overlapping Courses"] && (
                    <div className="discord-section-overlaps">
                        <span className="discord-detail-label">Overlaps:</span>
                        <span className="discord-overlaps">
                            {section["Overlapping Courses"]}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper function to parse meeting patterns and extract days/times
const parseMeetingPattern = (pattern) => {
    if (!pattern || typeof pattern !== "string") {
        return { days: "", startTime: "", endTime: "" };
    }

    // Handle formats with pipe separator like "M W F | 1:00 PM - 2:05 PM"
    if (pattern.includes("|")) {
        const [daysPart, timesPart] = pattern.split("|").map((p) => p.trim());
        const timeMatch = timesPart.match(
            /(\d+:\d+\s*(?:AM|PM))\s*-\s*(\d+:\d+\s*(?:AM|PM))/i
        );

        if (timeMatch) {
            return {
                days: daysPart,
                startTime: timeMatch[1],
                endTime: timeMatch[2],
            };
        }
    }

    // Try to handle other formats
    const dayMatch = pattern.match(/([MTWRFSU]+)/i);
    const timeMatch = pattern.match(
        /(\d+:?\d*\s*(?:AM|PM))\s*-\s*(\d+:?\d*\s*(?:AM|PM))/i
    );

    return {
        days: dayMatch ? dayMatch[1] : "",
        startTime: timeMatch ? timeMatch[1] : "",
        endTime: timeMatch ? timeMatch[2] : "",
    };
};

// Convert time string to decimal hours (more precise)
const timeToDecimal = (timeStr) => {
    if (!timeStr) return 0;

    // Convert formats like "9:15 AM" or "2:30PM" to decimal hours
    const match = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
    if (!match) return 0;

    let [, hours, minutes, ampm] = match;
    hours = parseInt(hours, 10);
    minutes = minutes ? parseInt(minutes, 10) : 0;

    // Adjust for AM/PM
    if (ampm && ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
    if (ampm && ampm.toUpperCase() === "AM" && hours === 12) hours = 0;

    // Return more precise decimal time
    return hours + minutes / 60;
};

// Extract days from meeting pattern
const getDaysFromPattern = (pattern) => {
    if (!pattern) return [];

    // First, try to extract the days part from the meeting pattern
    let daysText = "";

    if (pattern.includes("|")) {
        // Format like "M W F | 9:15 AM - 10:20 AM"
        daysText = pattern.split("|")[0].trim();
    } else {
        // Try to extract days from other formats
        const match = pattern.match(/^([MTWRFSUmtwrfsu\s]+)(?=\d|\s\d)/);
        if (match) {
            daysText = match[1].trim();
        } else {
            // Just use the whole pattern and try to find day codes
            daysText = pattern;
        }
    }

    // Now parse the days string to extract day indices
    const dayIndices = [];

    // Day code mappings - handle common abbreviations
    const dayMap = {
        M: 0,
        T: 1,
        W: 2,
        TH: 3,
        F: 4,
    };

    // Special case for "T Th" format
    if (/T\s+TH/i.test(daysText)) {
        dayIndices.push(1); // Tuesday
        dayIndices.push(3); // Thursday
        return dayIndices;
    }

    // Special case for "M W F" format
    if (/M\s+W\s+F/i.test(daysText)) {
        dayIndices.push(0); // Monday
        dayIndices.push(2); // Wednesday
        dayIndices.push(4); // Friday
        return dayIndices;
    }

    // Split by spaces for multi-day formats
    const parts = daysText.toUpperCase().split(/\s+/);

    // Check if we have multiple day codes separated by spaces
    if (parts.length > 1) {
        parts.forEach((part) => {
            if (dayMap[part] !== undefined) {
                // Check if the key exists instead of the value being truthy
                dayIndices.push(dayMap[part]);
            }
        });

        if (dayIndices.length > 0) {
            return dayIndices;
        }
    }

    // Check if we have multiple day codes separated by spaces
    if (parts.length > 1) {
        parts.forEach((part) => {
            if (dayMap[part]) {
                dayIndices.push(dayMap[part]);
            }
        });

        if (dayIndices.length > 0) {
            return dayIndices;
        }
    }

    // If we haven't returned yet, check for 'TH' and then individual characters
    let i = 0;
    while (i < daysText.length) {
        // Check for 'TH' pattern
        if (i + 1 < daysText.length && 
            daysText.substring(i, i + 2).toUpperCase() === 'TH') {
            dayIndices.push(dayMap['TH']);
            i += 2;
        } else {
            const char = daysText[i].toUpperCase();
            if (dayMap[char] !== undefined) {
                dayIndices.push(dayMap[char]);
            }
            i++;
        }
    }

    console.log(`Days extracted from "${pattern}": ${dayIndices.join(", ")}`);
    return dayIndices;
};

// WeeklySchedule Component
const WeeklySchedule = ({ selectedSections, onRemoveSection }) => {
    // Time slots from 8AM to 10PM
    const timeSlots = Array.from({ length: 15 }, (_, i) => i + 7);
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    // Get classes for a specific day and time slot
    const getClassesForSlot = (dayIndex, hourSlot) => {
        return selectedSections.filter((section) => {
            // Skip if no meeting pattern
            if (!section["Meeting Patterns"]) {
                return false;
            }

            // Parse meeting pattern
            const { days, startTime, endTime } = parseMeetingPattern(
                section["Meeting Patterns"]
            );

            // Get all days this class meets
            const dayIndices = getDaysFromPattern(section["Meeting Patterns"]);

            // Check if this specific day (dayIndex) is one of the days the class meets
            if (!dayIndices.includes(dayIndex)) {
                return false;
            }

            // Convert start time to decimal
            const startDecimal = timeToDecimal(startTime);

            // Get the hour part of the start time
            const startHour = Math.floor(startDecimal);

            // Compare with the current time slot
            if (startHour === hourSlot) {
                return true;
            }

            return false;
        });
    };

    // Pre-process class info to calculate heights based on duration
    const processClassStyle = (section) => {
        const { startTime, endTime } = parseMeetingPattern(
            section["Meeting Patterns"]
        );
        const startDecimal = timeToDecimal(startTime);
        const endDecimal = timeToDecimal(endTime);
        const durationHours = endDecimal - startDecimal;

        // Calculate height based on duration (each hour = 60px height)
        // Add a small adjustment to ensure precision
        const heightInPx = Math.max(Math.round(durationHours * 60), 60);

        // Calculate top position based on minutes into the hour
        const startHour = Math.floor(startDecimal);
        const minutesIntoHour = (startDecimal - startHour) * 60;
        
        // Round to the nearest pixel to avoid floating point issues
        const topOffset = Math.round(minutesIntoHour);

        return {
            height: `${heightInPx}px`,
            backgroundColor: getCourseColor(section["Course Section"]),
            position: "absolute",
            top: `${topOffset}px`,
            left: "0",
            right: "0",
        };
    };

    // Get random color based on course code (but consistent for same code)
    const getCourseColor = (courseSection) => {
        const colors = [
            "#7289da", // Discord blue
            "#43b581", // Discord green
            "#faa61a", // Discord yellow
            "#f04747", // Discord red
            "#593695", // Discord purple
            "#3498db", // Light blue
            "#2ecc71", // Emerald
            "#e74c3c", // Red
            "#9b59b6", // Purple
            "#5865f2", // Discord blurple
        ];

        // Simple hash function for consistent color
        let hash = 0;
        if (typeof courseSection === "string") {
            for (let i = 0; i < courseSection.length; i++) {
                hash = courseSection.charCodeAt(i) + ((hash << 5) - hash);
            }
        }

        return colors[Math.abs(hash) % colors.length];
    };

    // If no sections are selected, show the empty message
    if (selectedSections.length === 0) {
        return (
            <div className="discord-empty-schedule">
                <p>Select course sections to build your schedule</p>
            </div>
        );
    }

    return (
        <div className="discord-weekly-schedule">
            <div className="discord-schedule-header">
                <div className="discord-time-column"></div>
                {days.map((day) => (
                    <div key={day} className="discord-day-column">
                        {day}
                    </div>
                ))}
            </div>

            <div className="discord-schedule-body">
                {timeSlots.map((time) => (
                    <div key={time} className="discord-time-row">
                        <div className="discord-time-label">
                            {time % 12 || 12}
                            {time >= 12 ? "PM" : "AM"}
                        </div>

                        {days.map((_, dayIndex) => {
                            const classes = getClassesForSlot(dayIndex, time);
                            return (
                                <div
                                    key={dayIndex}
                                    className="discord-schedule-cell"
                                    style={{ position: "relative" }}
                                >
                                    {/* Add hour markers for every 15 minutes to improve precision */}
                                    <div className="discord-hour-markers">
                                        <div className="discord-hour-marker quarter" style={{top: "15px"}}></div>
                                        <div className="discord-hour-marker half" style={{top: "30px"}}></div>
                                        <div className="discord-hour-marker quarter" style={{top: "45px"}}></div>
                                    </div>
                                    
                                    {classes.map((section) => {
                                        const style = processClassStyle(section);
                                        return (
                                            <div
                                                key={section["Course Section"]}
                                                className="discord-schedule-class"
                                                style={style}
                                            >
                                                <div className="discord-schedule-class-code">
                                                    {section["Course Section"]}
                                                </div>
                                                <div className="discord-schedule-class-location">
                                                    {section["Locations"] || ""}
                                                </div>
                                                <button
                                                    className="discord-remove-class-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRemoveSection(section);
                                                    }}
                                                    aria-label={`Remove ${section["Course Section"]}`}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

function CourseExplorer() {
    // All course data from CSV
    const [allCourses, setAllCourses] = useState([]);

    // Currently displayed/filtered courses
    const [displayedCourses, setDisplayedCourses] = useState([]);

    // Loading state
    const [loading, setLoading] = useState(true);

    // Filter states
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedLevel, setSelectedLevel] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Selected course and related data
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [dependentCourses, setDependentCourses] = useState([]);

    // Statistics
    const [departmentStats, setDepartmentStats] = useState({});

    // New states for Schedule View
    const [viewMode, setViewMode] = useState("schedule"); // Default to schedule view
    const [courseSections, setCourseSections] = useState([]);
    const [filteredSections, setFilteredSections] = useState([]);
    const [scheduleLoading, setScheduleLoading] = useState(true);

    const [conflictError, setConflictError] = useState(null);
    const [showConflict, setShowConflict] = useState(false);

    const [schedules, setSchedules] = useState([
        { id: "schedule-1", name: "Schedule 1", sections: [] },
    ]);
    const [activeScheduleId, setActiveScheduleId] = useState("schedule-1");
    const [editingScheduleId, setEditingScheduleId] = useState(null);
    const [newScheduleName, setNewScheduleName] = useState("");

    // Get the active schedule
    const activeSchedule =
        schedules.find((schedule) => schedule.id === activeScheduleId) ||
        schedules[0];

    const selectedSections = activeSchedule.sections;

    // Remove prerequisites text from description
    const removePrerequisitesFromDescription = useCallback((description) => {
        if (!description) return "";

        const prereqPattern =
            /\b(pre-?req-?uisite[s]?:|prerequisite[s]?:|prereq[s]?:|co-?req-?uisite[s]?:|coreq[s]?:|successful completion of)/i;
        const parts = description.split(prereqPattern);

        if (parts.length > 1) {
            return parts[0].trim();
        }

        return description;
    }, []);

    // Process raw course data from CSV and deduplicate
    const processRawCourseData = useCallback(
        (rawData) => {
            // First, process all courses
            const processedCourses = rawData
                .filter((course) => course.tag && course.tag.trim() !== "")
                .map((course) => ({
                    id: `${course.tag}${course.number}`,
                    tag: course.tag.trim(),
                    number: course.number || "",
                    name: course.course || "",
                    description: removePrerequisitesFromDescription(
                        course.description || ""
                    ),
                    prerequisites: course.pre_reqs || "",
                    // For level, we'll simplify to "lower" (<100) or "upper" (≥100)
                    level:
                        course.number && parseInt(course.number) >= 100
                            ? "upper"
                            : "lower",
                    display: `${course.tag} ${course.number} - ${course.course}`,
                }));

            // Then deduplicate based on course ID
            const uniqueCourses = {};
            processedCourses.forEach((course) => {
                uniqueCourses[course.id] = course;
            });

            // Convert back to array
            const deduplicatedCourses = Object.values(uniqueCourses);

            console.log(
                `Processed ${rawData.length} raw courses into ${deduplicatedCourses.length} unique courses`
            );
            return deduplicatedCourses;
        },
        [removePrerequisitesFromDescription]
    );

    // Calculate department statistics
    const calculateDepartmentStats = useCallback((courses) => {
        const stats = {};

        courses.forEach((course) => {
            if (!stats[course.tag]) {
                stats[course.tag] = 0;
            }
            stats[course.tag]++;
        });

        setDepartmentStats(stats);
    }, []);

    // Fetch and process course data
    const fetchCourseData = useCallback(async () => {
        try {
            const response = await fetch("/courses.csv");
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (result) => {
                    console.log(
                        "CSV Parse Complete:",
                        result.data.length,
                        "courses"
                    );

                    // Process the data
                    const processedData = processRawCourseData(result.data);

                    // Update state with all courses
                    setAllCourses(processedData);
                    setDisplayedCourses(processedData);

                    // Calculate stats
                    calculateDepartmentStats(processedData);

                    // Finish loading
                    setLoading(false);
                },
                error: (error) => {
                    console.error("CSV Parse Error:", error);
                    setLoading(false);
                },
            });
        } catch (error) {
            console.error("Error fetching course data:", error);
            setLoading(false);
        }
    }, [processRawCourseData, calculateDepartmentStats]);

    // Fetch and process course sections data from Excel file
    const fetchCourseSections = useCallback(async () => {
        try {
            setScheduleLoading(true);
            console.log("Fetching course sections data...");

            // Fetch the Excel file
            const response = await fetch("/spring2025.xlsx");

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch Excel file: ${response.status} ${response.statusText}`
                );
            }

            const arrayBuffer = await response.arrayBuffer();
            console.log("Excel file fetched successfully");

            // Parse Excel data using SheetJS
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, {
                type: "array",
                cellDates: true,
            });

            // Get the first worksheet
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];

            // Convert to JSON
            const rawSections = XLSX.utils.sheet_to_json(worksheet);
            console.log("Excel Parse Results:", rawSections.length, "rows");

            if (rawSections.length > 0) {
                const sampleRow = rawSections[0];
                const foundColumns = Object.keys(sampleRow);

                console.log("Found columns:", foundColumns);

                // Verify we have the most critical column
                if (!foundColumns.includes("Course Section")) {
                    throw new Error(
                        "Required column 'Course Section' not found in Excel file"
                    );
                }

                // Filter out sections without a course section identifier
                const validSections = rawSections.filter(
                    (section) =>
                        section["Course Section"] &&
                        section["Course Section"].trim() !== ""
                );

                if (validSections.length > 0) {
                    console.log(
                        `Found ${validSections.length} valid course sections`
                    );
                    setCourseSections(validSections);
                    setFilteredSections(validSections);
                } else {
                    throw new Error(
                        "No valid course sections found in the file"
                    );
                }
            } else {
                throw new Error("No rows found in the Excel file");
            }
        } catch (error) {
            console.error("Error processing course sections:", error);
            // Create a friendly error message
            setCourseSections([
                {
                    "Course Section": "ERROR - Failed to load course data",
                    "All Instructors": "Please check the Excel file format",
                    Units: "",
                    "Meeting Patterns": "",
                    Locations: "",
                    "Course Tags": "Error: " + error.message,
                    "Overlapping Courses": "",
                },
            ]);
            setFilteredSections([]);
        } finally {
            setScheduleLoading(false);
        }
    }, []);

    // Apply filters to course data
    const applyFilters = useCallback(() => {
        console.log("Applying filters:", {
            department: selectedDepartment,
            level: selectedLevel,
            search: searchTerm,
        });

        // Start with all courses
        let filtered = [...allCourses];

        // Apply department filter (exact match)
        if (selectedDepartment) {
            console.log(`Filtering by department: ${selectedDepartment}`);
            filtered = filtered.filter(
                (course) => course.tag === selectedDepartment
            );
        }

        // Apply level filter
        if (selectedLevel) {
            filtered = filtered.filter(
                (course) => course.level === selectedLevel
            );
        }

        // Apply enhanced search filter with prioritization
        if (searchTerm && searchTerm.trim()) {
            const search = searchTerm.toLowerCase().trim();

            // Check if the search looks like a full course code (e.g., "CSEN 169" or "CSEN/COEN 12")
            const fullCourseCodeMatch = search.match(
                /^([a-z]{2,4}(?:\/[a-z]{2,4})*)\s*(\d+[a-z]?)/i
            );

            if (fullCourseCodeMatch) {
                // Extract department code(s) and course number
                const [, deptCodesRaw, courseNum] = fullCourseCodeMatch;
                const deptCodes = deptCodesRaw
                    .split("/")
                    .map((code) => code.toUpperCase());

                // Find matches for any of the alternative department codes with the course number
                const fullCodeMatches = filtered.filter(
                    (course) =>
                        deptCodes.includes(course.tag.toUpperCase()) &&
                        course.number.includes(courseNum)
                );

                // If we found matches, use only those
                if (fullCodeMatches.length > 0) {
                    console.log(
                        `Found ${fullCodeMatches.length} matches for full course code: ${deptCodesRaw} ${courseNum}`
                    );
                    filtered = fullCodeMatches;
                } else {
                    // If no direct matches, then fall back to the original search logic
                    filtered = applyOriginalSearch(filtered, search);
                }
            } else {
                // Apply original search if not a course code format
                filtered = applyOriginalSearch(filtered, search);
            }

            console.log(
                `Search for "${search}" returned ${filtered.length} results`
            );
        }

        console.log(`Applied filters: ${filtered.length} courses matched`);
        setDisplayedCourses(filtered);
    }, [allCourses, selectedDepartment, selectedLevel, searchTerm]);

    // Helper function to apply the original search logic
    const applyOriginalSearch = (courses, search) => {
        // First try exact tag matches
        const exactTagMatches = courses.filter(
            (course) => course.tag.toLowerCase() === search
        );

        if (exactTagMatches.length > 0) {
            // If we have exact tag matches, use only those
            return exactTagMatches;
        } else {
            // Otherwise, create separate arrays for different match types
            const tagPrefixMatches = []; // Matches that start with the search term
            const tagContainsMatches = []; // Matches that contain the search term elsewhere
            const numberMatches = [];
            const nameMatches = [];
            const descriptionMatches = [];

            // Sort each course into the appropriate category
            courses.forEach((course) => {
                const lowerTag = course.tag.toLowerCase();
                const lowerNumber = course.number.toLowerCase();
                const lowerName = course.name.toLowerCase();
                const lowerDesc = course.description.toLowerCase();

                // Check tag first (with prefix priority)
                if (lowerTag.startsWith(search)) {
                    tagPrefixMatches.push(course);
                } else if (lowerTag.includes(search)) {
                    tagContainsMatches.push(course);
                }
                // Then check number
                else if (lowerNumber.includes(search)) {
                    numberMatches.push(course);
                }
                // Then check name
                else if (lowerName.includes(search)) {
                    nameMatches.push(course);
                }
                // Finally check description
                else if (lowerDesc.includes(search)) {
                    descriptionMatches.push(course);
                }
            });

            // Combine results in priority order (without duplicates)
            // We'll use a Set to track courses we've already included
            const includedCourseIds = new Set();
            const prioritizedResults = [];

            // Helper function to add courses to result without duplicates
            const addCourses = (coursesToAdd) => {
                coursesToAdd.forEach((course) => {
                    if (!includedCourseIds.has(course.id)) {
                        includedCourseIds.add(course.id);
                        prioritizedResults.push(course);
                    }
                });
            };

            // Add courses in priority order
            addCourses(tagPrefixMatches);
            addCourses(tagContainsMatches);
            addCourses(numberMatches);
            addCourses(nameMatches);
            addCourses(descriptionMatches);

            return prioritizedResults;
        }
    };

    // Filter sections by search term
    const filterSections = useCallback(
        (searchTerm = "") => {
            if (!searchTerm.trim()) {
                setFilteredSections(courseSections);
                return;
            }

            const term = searchTerm.toLowerCase().trim();
            const filtered = courseSections.filter(
                (section) =>
                    (section["Course Section"] &&
                        section["Course Section"]
                            .toLowerCase()
                            .includes(term)) ||
                    (section["All Instructors"] &&
                        section["All Instructors"]
                            .toLowerCase()
                            .includes(term)) ||
                    (section["Meeting Patterns"] &&
                        section["Meeting Patterns"]
                            .toLowerCase()
                            .includes(term)) ||
                    (section["Locations"] &&
                        section["Locations"].toLowerCase().includes(term)) ||
                    (section["Course Tags"] &&
                        section["Course Tags"].toLowerCase().includes(term))
            );

            setFilteredSections(filtered);
        },
        [courseSections]
    );

    // Toggle section selection with improved conflict detection
    const toggleSectionSelection = useCallback(
        (section) => {
            // First clear any previous conflict messages
            setShowConflict(false);
            setConflictError(null);

            setSchedules((prevSchedules) => {
                return prevSchedules.map((schedule) => {
                    if (schedule.id !== activeScheduleId) return schedule;

                    const isAlreadySelected = schedule.sections.some(
                        (s) => s["Course Section"] === section["Course Section"]
                    );

                    if (isAlreadySelected) {
                        return {
                            ...schedule,
                            sections: schedule.sections.filter(
                                (s) =>
                                    s["Course Section"] !==
                                    section["Course Section"]
                            ),
                        };
                    } else {
                        // Check for time conflicts before adding
                        const conflictingSection = getConflictingSection(
                            section,
                            schedule.sections
                        );

                        if (conflictingSection) {
                            // Show conflict banner
                            setConflictError({
                                section: section["Course Section"],
                                conflictsWith:
                                    conflictingSection["Course Section"],
                            });
                            setShowConflict(true);

                            // Don't add the section with conflict
                            return schedule;
                        }
                        // No conflicts, add the section
                        return {
                            ...schedule,
                            sections: [...schedule.sections, section],
                        };
                    }
                });
            });
        },
        [activeScheduleId]
    );

    // Add a new schedule
    const addNewSchedule = () => {
        const newId = `schedule-${schedules.length + 1}`;
        const newSchedule = {
            id: newId,
            name: `Schedule ${schedules.length + 1}`,
            sections: [],
        };
        setSchedules([...schedules, newSchedule]);
        setActiveScheduleId(newId);
    };

    // Delete the active schedule
    const deleteActiveSchedule = () => {
        if (schedules.length <= 1) return; // Don't delete the last schedule

        const newSchedules = schedules.filter(
            (schedule) => schedule.id !== activeScheduleId
        );
        setSchedules(newSchedules);
        setActiveScheduleId(newSchedules[0].id);
    };

    // Start editing schedule name
    const startEditingName = (scheduleId, scheduleName) => {
        setNewScheduleName(scheduleName);
        setEditingScheduleId(scheduleId);
    };

    // Save the edited schedule name
    const saveScheduleName = () => {
        if (!newScheduleName.trim()) {
            setEditingScheduleId(null);
            return;
        }

        setSchedules((prevSchedules) =>
            prevSchedules.map((schedule) =>
                schedule.id === editingScheduleId
                    ? { ...schedule, name: newScheduleName.trim() }
                    : schedule
            )
        );
        setEditingScheduleId(null);
    };

    // Handle tab click (activate or edit)
    const handleTabClick = (scheduleId, scheduleName) => {
        if (scheduleId === activeScheduleId) {
            // If already active, start editing
            startEditingName(scheduleId, scheduleName);
        } else {
            // If not active, just switch to this tab
            setActiveScheduleId(scheduleId);
        }
    };

    // Enhanced conflict detection that returns the conflicting section
    const getConflictingSection = (newSection, existingSections) => {
        // Skip if no meeting pattern
        if (!newSection["Meeting Patterns"]) return null;

        // Parse meeting pattern for the new section
        const newPattern = parseMeetingPattern(newSection["Meeting Patterns"]);
        const newDayIndices = getDaysFromPattern(
            newSection["Meeting Patterns"]
        );
        const newStartDecimal = timeToDecimal(newPattern.startTime);
        const newEndDecimal = timeToDecimal(newPattern.endTime);

        // Check against each existing section
        for (const existingSection of existingSections) {
            // Skip if no meeting pattern
            if (!existingSection["Meeting Patterns"]) continue;

            // Parse meeting pattern for the existing section
            const existingPattern = parseMeetingPattern(
                existingSection["Meeting Patterns"]
            );
            const existingDayIndices = getDaysFromPattern(
                existingSection["Meeting Patterns"]
            );
            const existingStartDecimal = timeToDecimal(
                existingPattern.startTime
            );
            const existingEndDecimal = timeToDecimal(existingPattern.endTime);

            // Check for day overlap - do they share any days?
            const sharedDays = newDayIndices.filter((day) =>
                existingDayIndices.includes(day)
            );

            if (sharedDays.length > 0) {
                // Check for time overlap
                if (
                    // New section starts during existing section
                    (newStartDecimal >= existingStartDecimal &&
                        newStartDecimal < existingEndDecimal) ||
                    // New section ends during existing section
                    (newEndDecimal > existingStartDecimal &&
                        newEndDecimal <= existingEndDecimal) ||
                    // New section completely contains existing section
                    (newStartDecimal <= existingStartDecimal &&
                        newEndDecimal >= existingEndDecimal) ||
                    // Equal time slots
                    (newStartDecimal === existingStartDecimal &&
                        newEndDecimal === existingEndDecimal)
                ) {
                    return existingSection; // Return the conflicting section
                }
            }
        }

        return null; // No conflicts
    };

    // Load course data and sections on component mount
    useEffect(() => {
        // Only load course data once on mount
        const loadData = async () => {
            await fetchCourseData();
            await fetchCourseSections();
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array = only run once

    useEffect(() => {
        if (allCourses.length > 0) {
            applyFilters();
        }
    }, [
        allCourses,
        selectedDepartment,
        selectedLevel,
        searchTerm,
        applyFilters,
    ]);

    useEffect(() => {
        if (courseSections.length > 0) {
            // When course sections are loaded, set filtered sections to all sections
            setFilteredSections(courseSections);
        }
    }, [courseSections]);

    // Find courses that depend on this course
    const findDependentCourses = useCallback(
        (course) => {
            const dependents = allCourses.filter((c) => {
                if (!c.prerequisites) return false;

                // Handle slash notation in prerequisites when checking for dependents
                let isDependent = false;

                // Check if this course is mentioned directly
                const directPattern = new RegExp(
                    course.tag + "\\s?" + course.number
                );
                if (directPattern.test(c.prerequisites)) {
                    isDependent = true;
                }

                // If this course is a slash notation, also check for alternatives
                if (course.tag.includes("/")) {
                    const deptCodes = course.tag.split("/");
                    deptCodes.forEach((dept) => {
                        const altPattern = new RegExp(
                            dept + "\\s?" + course.number
                        );
                        if (altPattern.test(c.prerequisites)) {
                            isDependent = true;
                        }
                    });
                }

                return isDependent;
            });

            setDependentCourses(dependents);
        },
        [allCourses]
    );

    // Handle course selection
    const handleCourseSelect = useCallback(
        (course) => {
            console.log("Selected course:", course.id);
            setSelectedCourse(course);
            findDependentCourses(course);
        },
        [findDependentCourses]
    );

    // Format prerequisites text with simple highlighting and remove labels
    const formatPrerequisiteText = useCallback((text) => {
        if (!text) return null;

        // First strip common labels and prefixes from the text
        let cleanedText = text
            // Remove "Prerequisites:" or "Prerequisite:" prefix
            .replace(/^(prerequisites?:?\s*)/i, "")
            // Remove "Prerequisite: a" pattern
            .replace(/^(prerequisite:?\s*a\s*)/i, "")
            // Remove "Corequisites:" or "Corequisite:" prefix
            .replace(/^(co-?requisites?:?\s*)/i, "")
            // Remove "Recommended corequisite:" prefix
            .replace(/^(recommended co-?requisites?:?\s*)/i, "")
            // Remove common phrases like "a" or "the" at the start
            .replace(/^(a|the)\s+/i, "")
            // Fix decimal points in GPA requirements (convert space to decimal)
            .replace(/(\d)\s+(\d)/g, "$1.$2")
            // Ensure GPA values have proper decimal
            .replace(/\bGPA of (\d)(?!\.\d)/gi, "GPA of $1.0")
            // Fix missing decimal in "minimum GPA of X" pattern
            .replace(/\bminimum GPA of (\d)(?!\.\d)/gi, "minimum GPA of $1.0")
            // Remove trailing periods
            .replace(/\.\s*$/, "")
            // Remove orphaned periods within the text
            .replace(/\s*\.\s*/g, " ")
            .trim();

        // Simple formatting with highlighting but no complex parsing
        const highlightedText = cleanedText
            // Highlight course codes including those with slash notation
            .replace(
                /([A-Z]{2,4}(?:\/[A-Z]{2,4})*)[ -]?(\d{1,3}[A-Z]?)/g,
                '<span class="discord-highlight">$1 $2</span>'
            )
            // Highlight "grade of X" requirements
            .replace(/\b(grade of [A-D][+-]?)/gi, "<strong>$1</strong>")
            // Highlight GPA requirements
            .replace(
                /\b((?:minimum )?GPA of \d+\.\d+)/gi,
                "<strong>$1</strong>"
            )
            // Highlight academic standing
            .replace(
                /\b(junior|senior) standing\b/gi,
                "<strong>$1 standing</strong>"
            );

        return (
            <p
                className="discord-prereq-text"
                dangerouslySetInnerHTML={{ __html: highlightedText }}
            />
        );
    }, []);

    // Check if a string contains co-requisite instructions
    const hasCorequisites = useCallback((text) => {
        return (
            text &&
            /concurrent|co-requisite|corequisite|recommended co-requisite|recommended corequisite/i.test(
                text
            )
        );
    }, []);

    // Split prerequisites and corequisites if both are present
    const splitPrereqsAndCoreqs = useCallback((text) => {
        if (!text) return { prereqs: "", coreqs: "" };

        // First, clean up the text by removing any trailing periods
        const cleanedText = text.replace(/\.\s*$/, "");

        // Check for corequisite section
        const coreqPatterns = [
            /co-?requisites?[:.](.+?)(?=\.|$)/i,
            /corequisites?[:.](.+?)(?=\.|$)/i,
            /\bconcurrent(?:ly)? (?:with|enroll(?:ment)? in)(.+?)(?=\.|$)/i,
            /\btake concurrently(?:ly)?(?:[ :])(.+?)(?=\.|$)/i,
            /\bmust be taken concurrent(?:ly)? with(.+?)(?=\.|$)/i,
            /recommended co-?requisites?[:.](.+?)(?=\.|$)/i,
        ];

        for (const pattern of coreqPatterns) {
            const match = cleanedText.match(pattern);
            if (match) {
                // Get corequisites and clean any prefix/suffix
                const coreqs = match[1]
                    .trim()
                    .replace(/\.\s*$/, "")
                    .replace(/^(a|the) /i, "");

                // Remove the coreq section from the prereq text and clean
                const prereqs = cleanedText
                    .replace(match[0], "")
                    .trim()
                    .replace(/\.\s*$/, "")
                    .replace(/^prerequisites?:?\s*/i, "")
                    .replace(/^(a|the) /i, "");

                return {
                    prereqs: prereqs.replace(/\s*\.\s*/g, " ").trim(),
                    coreqs: coreqs.replace(/\s*\.\s*/g, " ").trim(),
                };
            }
        }

        // If no corequisites found, return the whole cleaned text as prerequisites
        return {
            prereqs: cleanedText
                .replace(/\s*\.\s*/g, " ")
                .replace(/^prerequisites?:?\s*/i, "")
                .replace(/^(a|the) /i, "")
                .trim(),
            coreqs: "",
        };
    }, []);

    // Reset all filters
    const resetFilters = useCallback(() => {
        setSelectedDepartment("");
        setSelectedLevel("");
        setSearchTerm("");
    }, []);

    // Get unique departments for filter
    const uniqueDepartments = [
        ...new Set(allCourses.map((course) => course.tag)),
    ].sort();

    // Calendar Export Function
    const exportToCalendar = useCallback(() => {
        if (selectedSections.length === 0) {
            return;
        }

        // Get the first section to extract term dates (all sections should have the same dates)
        const firstSection = courseSections[0];
        let termStart, termEnd;

        // Try to extract term dates from the Excel data
        if (
            firstSection &&
            firstSection["Start Date"] &&
            firstSection["End Date"]
        ) {
            // If dates are already Date objects
            if (firstSection["Start Date"] instanceof Date) {
                termStart = new Date(firstSection["Start Date"]);
                termEnd = new Date(firstSection["End Date"]);
            } else {
                // If dates are strings, parse them
                try {
                    termStart = new Date(firstSection["Start Date"]);
                    termEnd = new Date(firstSection["End Date"]);
                } catch (e) {
                    console.error("Error parsing term dates:", e);
                    // Fallback to default dates for next quarter
                    termStart = new Date("2025-01-06");
                    termEnd = new Date("2025-03-21");
                }
            }
        } else {
            // Fallback to default dates for next quarter
            termStart = new Date("2025-01-06");
            termEnd = new Date("2025-03-21");
        }

        console.log("Using term dates:", { start: termStart, end: termEnd });

        // PST timezone
        const timeZone = "America/Los_Angeles";

        // Create iCalendar content
        let icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//SCU Course Explorer//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:SCU Schedule",
            "X-WR-TIMEZONE:" + timeZone,
            "BEGIN:VTIMEZONE",
            "TZID:" + timeZone,
            "BEGIN:STANDARD",
            "DTSTART:19701101T020000",
            "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
            "TZOFFSETFROM:-0700",
            "TZOFFSETTO:-0800",
            "TZNAME:PST",
            "END:STANDARD",
            "BEGIN:DAYLIGHT",
            "DTSTART:19700308T020000",
            "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
            "TZOFFSETFROM:-0800",
            "TZOFFSETTO:-0700",
            "TZNAME:PDT",
            "END:DAYLIGHT",
            "END:VTIMEZONE",
        ];

        // Process each selected section
        selectedSections.forEach((section) => {
            // Skip if no meeting pattern
            if (!section["Meeting Patterns"]) return;

            // Parse meeting pattern
            const { days, startTime, endTime } = parseMeetingPattern(
                section["Meeting Patterns"]
            );

            // Get day indices (0 for Monday, 1 for Tuesday, etc.)
            const dayIndices = getDaysFromPattern(section["Meeting Patterns"]);

            // Skip if no valid days found
            if (dayIndices.length === 0) return;

            // Create events for each day this class meets
            dayIndices.forEach((dayIndex) => {
                // Calculate the first occurrence date for this day
                // Day of week in JavaScript: 0 is Sunday, we're using 0 for Monday
                // So we need to convert: our 0 (Monday) is JavaScript's 1, etc.
                const jsWeekDay = dayIndex === 6 ? 0 : dayIndex + 1; // Convert to JavaScript day (0=Sunday, 1=Monday)

                const firstOccurrence = new Date(termStart);
                // Find the next day that matches our day of week
                while (firstOccurrence.getDay() !== jsWeekDay) {
                    firstOccurrence.setDate(firstOccurrence.getDate() + 1);
                }

                // Parse times
                const startDateTime = convertTimeToDateTime(
                    firstOccurrence,
                    startTime
                );
                const endDateTime = convertTimeToDateTime(
                    firstOccurrence,
                    endTime
                );

                // Skip if invalid times
                if (!startDateTime || !endDateTime) return;

                // Format times for iCalendar with proper TZID
                const startDateTimeString = formatDateForICS(
                    startDateTime,
                    timeZone
                );
                const endDateTimeString = formatDateForICS(
                    endDateTime,
                    timeZone
                );

                // Create the recurrence rule (weekly until term end)
                // Add one day to make sure the end date is inclusive
                const untilDate = new Date(termEnd);
                untilDate.setDate(untilDate.getDate() + 1);
                const untilString =
                    untilDate.toISOString().replace(/[-:]/g, "").split(".")[0] +
                    "Z";

                // Build a proper description with escaped characters
                const description = `Instructor: ${
                    section["All Instructors"] || "TBA"
                }\\n${section["Course Tags"] || ""}\\nUnits: ${
                    section["Units"] || ""
                }`;

                // Add event to calendar
                icsContent = [
                    ...icsContent,
                    "BEGIN:VEVENT",
                    `SUMMARY:${section["Course Section"]}`,
                    `LOCATION:${section["Locations"] || "TBA"}`,
                    `DESCRIPTION:${description.replace(/,/g, "\\,")}`,
                    `DTSTART;TZID=${timeZone}:${startDateTimeString}`,
                    `DTEND;TZID=${timeZone}:${endDateTimeString}`,
                    `RRULE:FREQ=WEEKLY;UNTIL=${untilString}`,
                    "END:VEVENT",
                ];
            });
        });

        // Close the calendar
        icsContent.push("END:VCALENDAR");

        // Create and download the file
        const icsData = icsContent.join("\r\n");
        const blob = new Blob([icsData], {
            type: "text/calendar;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const fileName = `SCU_${activeSchedule.name.replace(/\s+/g, "_")}.ics`;
        link.setAttribute("download", fileName);

        // Create a success message element
        const successMessage = document.createElement("div");
        successMessage.className = "discord-calendar-success";
        successMessage.innerHTML = `
            <div class="discord-success-content">
                <span class="discord-success-icon">✓</span>
                <div class="discord-success-text">
                    <strong>Schedule downloaded!</strong>
                    <p>Open the file to add it to your calendar app</p>
                </div>
                <button class="discord-success-close">×</button>
            </div>
        `;

        // Add the success message to the document
        document.body.appendChild(successMessage);

        // Add click handler to close button
        const closeButton = successMessage.querySelector(
            ".discord-success-close"
        );
        if (closeButton) {
            closeButton.addEventListener("click", () => {
                document.body.removeChild(successMessage);
            });
        }

        // Auto-remove the message after 6 seconds
        setTimeout(() => {
            if (document.body.contains(successMessage)) {
                document.body.removeChild(successMessage);
            }
        }, 6000);

        // Trigger the download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [selectedSections, courseSections, activeSchedule.name]);

    // Helper function to convert a time string to a Date object
    const convertTimeToDateTime = (baseDate, timeStr) => {
        if (!timeStr) return null;

        // Parse time like "10:30 AM"
        const match = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
        if (!match) return null;

        let [, hours, minutes, ampm] = match;
        hours = parseInt(hours, 10);
        minutes = minutes ? parseInt(minutes, 10) : 0;

        // Adjust for AM/PM
        if (ampm && ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
        if (ampm && ampm.toUpperCase() === "AM" && hours === 12) hours = 0;

        // Create a new date based on the base date
        const dateObj = new Date(baseDate);
        dateObj.setHours(hours, minutes, 0, 0);

        return dateObj;
    };

    // Helper function to format a date for ICS file
    const formatDateForICS = (date) => {
        // When using with TZID parameter, use LOCAL time components, not UTC
        // Format as: YYYYMMDDTHHMMSS
        return (
            date.getFullYear() +
            String(date.getMonth() + 1).padStart(2, "0") +
            String(date.getDate()).padStart(2, "0") +
            "T" +
            String(date.getHours()).padStart(2, "0") +
            String(date.getMinutes()).padStart(2, "0") +
            String(date.getSeconds()).padStart(2, "0")
        );
    };

    return (
        <div className="discord-explorer-container">
            {/* Add this banner near the top of your return statement */}
            {showConflict && (
                <div className="discord-conflict-banner">
                    <div className="discord-conflict-content">
                        <span className="discord-conflict-icon">⚠️</span>
                        <span>
                            Time conflict detected:{" "}
                            <strong>{conflictError?.section}</strong> overlaps
                            with <strong>{conflictError?.conflictsWith}</strong>
                        </span>
                        <button
                            className="discord-conflict-close"
                            onClick={() => setShowConflict(false)}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
            <div className="discord-explorer-header">
                <h1>Scheduler</h1>
                <p>Discover and analyze course offerings</p>
                <ModeToggle activeMode={viewMode} onChange={setViewMode} />
            </div>

            {loading && viewMode === "catalog" ? (
                <div className="discord-loading-container">
                    <div className="discord-loading-spinner"></div>
                    <p>Loading course data...</p>
                </div>
            ) : (
                <div className="discord-explorer-content">
                    {viewMode === "catalog" ? (
                        // Original Catalog View
                        <>
                            {/* Filters and search */}
                            <div className="discord-filters-container">
                                <div className="discord-filter-group">
                                    <label htmlFor="department-filter">
                                        Department
                                    </label>
                                    <select
                                        id="department-filter"
                                        value={selectedDepartment}
                                        onChange={(e) => {
                                            const dept = e.target.value;
                                            console.log(
                                                "Selecting department:",
                                                dept
                                            );
                                            setSelectedDepartment(dept);
                                        }}
                                        className="discord-filter-select"
                                    >
                                        <option value="">
                                            All Departments
                                        </option>
                                        {uniqueDepartments.map((dept) => (
                                            <option key={dept} value={dept}>
                                                {dept} (
                                                {departmentStats[dept] || 0})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="discord-filter-group">
                                    <label htmlFor="level-filter">
                                        Course Level
                                    </label>
                                    <select
                                        id="level-filter"
                                        value={selectedLevel}
                                        onChange={(e) =>
                                            setSelectedLevel(e.target.value)
                                        }
                                        className="discord-filter-select"
                                    >
                                        <option value="">All Levels</option>
                                        <option value="lower">
                                            Lower Division (Below 100)
                                        </option>
                                        <option value="upper">
                                            Upper Division (100+)
                                        </option>
                                    </select>
                                </div>

                                <div className="discord-filter-group discord-search-group">
                                    <label htmlFor="search-input">Search</label>
                                    <input
                                        id="search-input"
                                        type="text"
                                        placeholder="Search by tag, number, or name"
                                        value={searchTerm}
                                        onChange={(e) =>
                                            setSearchTerm(e.target.value)
                                        }
                                        className="discord-search-input"
                                    />
                                </div>
                            </div>

                            <div className="discord-explorer-layout">
                                {/* Course listing */}
                                <div className="discord-courses-list">
                                    <h2>Courses ({displayedCourses.length})</h2>

                                    {displayedCourses.length === 0 ? (
                                        <div className="discord-no-results">
                                            <p>
                                                No courses match your filters.
                                            </p>
                                            <button
                                                className="discord-reset-button"
                                                onClick={resetFilters}
                                            >
                                                Reset Filters
                                            </button>
                                        </div>
                                    ) : (
                                        <ul className="discord-course-items">
                                            {displayedCourses.map((course) => (
                                                <li
                                                    key={course.id}
                                                    className={`discord-course-item ${
                                                        selectedCourse &&
                                                        selectedCourse.id ===
                                                            course.id
                                                            ? "discord-selected"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        handleCourseSelect(
                                                            course
                                                        )
                                                    }
                                                >
                                                    <div className="discord-course-code">
                                                        {course.tag}{" "}
                                                        {course.number}
                                                    </div>
                                                    <div className="discord-course-name">
                                                        {course.name}
                                                    </div>
                                                    {course.prerequisites && (
                                                        <div className="discord-prereq-indicator">
                                                            <span className="discord-prereq-dot"></span>
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Course details */}
                                <div className="discord-course-details">
                                    {selectedCourse ? (
                                        <div className="discord-details-content">
                                            <h2>
                                                {selectedCourse.tag}{" "}
                                                {selectedCourse.number}
                                            </h2>
                                            <h3>{selectedCourse.name}</h3>

                                            <div className="discord-detail-section">
                                                <h4>Description</h4>
                                                <p>
                                                    {selectedCourse.description}
                                                </p>
                                            </div>

                                            {selectedCourse.prerequisites && (
                                                <div className="discord-detail-section">
                                                    <h4>
                                                        {hasCorequisites(
                                                            selectedCourse.prerequisites
                                                        )
                                                            ? "Prerequisites & Co-requisites"
                                                            : "Prerequisites"}
                                                    </h4>

                                                    {(() => {
                                                        const {
                                                            prereqs,
                                                            coreqs,
                                                        } =
                                                            splitPrereqsAndCoreqs(
                                                                selectedCourse.prerequisites
                                                            );

                                                        return (
                                                            <>
                                                                {prereqs && (
                                                                    <div className="discord-prereq-section">
                                                                        {coreqs && (
                                                                            <h5>
                                                                                Prerequisites:
                                                                            </h5>
                                                                        )}
                                                                        {formatPrerequisiteText(
                                                                            prereqs
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {coreqs && (
                                                                    <div className="discord-coreq-section">
                                                                        <h5>
                                                                            Co-requisites:
                                                                        </h5>
                                                                        {formatPrerequisiteText(
                                                                            coreqs
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            <div className="discord-detail-section">
                                                <h4>Required For</h4>
                                                {dependentCourses.length > 0 ? (
                                                    <div className="discord-course-tags">
                                                        {dependentCourses.map(
                                                            (course) => (
                                                                <span
                                                                    key={
                                                                        course.id
                                                                    }
                                                                    className="discord-required-course"
                                                                    onClick={() =>
                                                                        handleCourseSelect(
                                                                            course
                                                                        )
                                                                    }
                                                                >
                                                                    {course.tag}{" "}
                                                                    {
                                                                        course.number
                                                                    }
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p>
                                                        Not a prerequisite for
                                                        any course
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="discord-no-selection">
                                            <p>
                                                Select a course to view details
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        // Schedule View
                        <div className="discord-schedule-container">
                            {scheduleLoading ? (
                                <div className="discord-loading-container">
                                    <div className="discord-loading-spinner"></div>
                                    <p>Loading schedule data...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="discord-schedule-controls">
                                        <div className="discord-section-search">
                                            <input
                                                type="text"
                                                placeholder="Search by course section, instructor, location..."
                                                onChange={(e) =>
                                                    filterSections(
                                                        e.target.value
                                                    )
                                                }
                                                className="discord-search-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="discord-schedule-layout">
                                        <div className="discord-sections-panel">
                                            <h3>
                                                Available Sections (
                                                {filteredSections.length})
                                            </h3>
                                            <div className="discord-sections-list">
                                                {filteredSections.length ===
                                                0 ? (
                                                    <div className="discord-no-results">
                                                        <p>
                                                            No sections match
                                                            your search.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    filteredSections.map(
                                                        (section, index) => (
                                                            <CourseSection
                                                                key={
                                                                    section[
                                                                        "Course Section"
                                                                    ] || index
                                                                }
                                                                section={
                                                                    section
                                                                }
                                                                onSelect={
                                                                    toggleSectionSelection
                                                                }
                                                                isSelected={selectedSections.some(
                                                                    (s) =>
                                                                        s[
                                                                            "Course Section"
                                                                        ] ===
                                                                        section[
                                                                            "Course Section"
                                                                        ]
                                                                )}
                                                            />
                                                        )
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div className="discord-calendar-panel">
                                            <div className="discord-calendar-header">
                                                <h3>
                                                    Weekly Schedule (
                                                    {selectedSections.length}{" "}
                                                    courses)
                                                </h3>

                                                <div className="discord-schedule-tabs">
                                                    {schedules.map(
                                                        (schedule) => (
                                                            <div
                                                                key={
                                                                    schedule.id
                                                                }
                                                                className={`discord-schedule-tab ${
                                                                    schedule.id ===
                                                                    activeScheduleId
                                                                        ? "active"
                                                                        : ""
                                                                }`}
                                                            >
                                                                {editingScheduleId ===
                                                                schedule.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            newScheduleName
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setNewScheduleName(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        onBlur={
                                                                            saveScheduleName
                                                                        }
                                                                        onKeyDown={(
                                                                            e
                                                                        ) =>
                                                                            e.key ===
                                                                                "Enter" &&
                                                                            saveScheduleName()
                                                                        }
                                                                        autoFocus
                                                                        className="discord-schedule-name-edit"
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        onClick={() =>
                                                                            handleTabClick(
                                                                                schedule.id,
                                                                                schedule.name
                                                                            )
                                                                        }
                                                                        className="discord-schedule-name"
                                                                    >
                                                                        {
                                                                            schedule.name
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                    <button
                                                        className="discord-add-schedule-btn"
                                                        onClick={addNewSchedule}
                                                        title="Create new schedule"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <div className="discord-schedule-actions">
                                                    {schedules.length > 1 && (
                                                        <button
                                                            className="discord-delete-schedule-btn"
                                                            onClick={
                                                                deleteActiveSchedule
                                                            }
                                                            title="Delete schedule"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}

                                                    {selectedSections.length >
                                                        0 && (
                                                        <button
                                                            className="discord-calendar-export-btn"
                                                            onClick={
                                                                exportToCalendar
                                                            }
                                                            title="Export to Calendar"
                                                        >
                                                            <span className="export-icon">
                                                                📅
                                                            </span>{" "}
                                                            Export
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <WeeklySchedule
                                                selectedSections={
                                                    selectedSections
                                                }
                                                onRemoveSection={
                                                    toggleSectionSelection
                                                }
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default CourseExplorer;
