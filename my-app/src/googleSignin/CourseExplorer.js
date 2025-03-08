import React, { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import "./CourseExplorer.css";

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

    // Load course data on component mount
    useEffect(() => {
        fetchCourseData();
    }, [fetchCourseData]);

    // Apply filters whenever filter criteria change
    useEffect(() => {
        if (allCourses.length > 0) {
            applyFilters();
        }
    }, [allCourses, applyFilters]);

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

    return (
        <div className="discord-explorer-container">
            <div className="discord-explorer-header">
                <h1>Course Explorer</h1>
                <p>Discover and analyze course offerings</p>
            </div>

            {loading ? (
                <div className="discord-loading-container">
                    <div className="discord-loading-spinner"></div>
                    <p>Loading course data...</p>
                </div>
            ) : (
                <div className="discord-explorer-content">
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
                                    console.log("Selecting department:", dept);
                                    setSelectedDepartment(dept);
                                }}
                                className="discord-filter-select"
                            >
                                <option value="">All Departments</option>
                                {uniqueDepartments.map((dept) => (
                                    <option key={dept} value={dept}>
                                        {dept} ({departmentStats[dept] || 0})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="discord-filter-group">
                            <label htmlFor="level-filter">Course Level</label>
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
                                onChange={(e) => setSearchTerm(e.target.value)}
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
                                    <p>No courses match your filters.</p>
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
                                                selectedCourse.id === course.id
                                                    ? "discord-selected"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                handleCourseSelect(course)
                                            }
                                        >
                                            <div className="discord-course-code">
                                                {course.tag} {course.number}
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
                                        <p>{selectedCourse.description}</p>
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
                                                const { prereqs, coreqs } =
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
                                                            key={course.id}
                                                            className="discord-required-course"
                                                            onClick={() =>
                                                                handleCourseSelect(
                                                                    course
                                                                )
                                                            }
                                                        >
                                                            {course.tag}{" "}
                                                            {course.number}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p>
                                                Not a prerequisite for any
                                                course
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="discord-no-selection">
                                    <p>Select a course to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CourseExplorer;
