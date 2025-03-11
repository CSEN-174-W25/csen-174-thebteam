import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import Fuse from "fuse.js";
import { auth, db, doc, setDoc, getDoc } from "./config"; // Firebase imports
import { onAuthStateChanged } from "firebase/auth";
import "./FourYearPlan.css";

const NUM_TABLES = 4; // Number of tables

// Updated colors that match the dark theme better
const COLOR_OPTIONS = [
    "#7289DA", // Discord Blurple
    "#43B581", // Discord Green
    "#FAA61A", // Discord Yellow
    "#F04747", // Discord Red
    "#9B84EE", // Light Purple
    "#FF73FA", // Pink
    "#3498DB", // Light Blue
    "#E67E22", // Orange
    "#2ECC71", // Green
    "#36393F", // Discord Dark (reset option)
];

const FourYearPlan = () => {
    const [courses, setCourses] = useState([]);
    const [searchResults, setSearchResults] = useState(
        Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill([]))
    );
    const [searchQueries, setSearchQueries] = useState(
        Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(""))
    );
    const [selectedCourses, setSelectedCourses] = useState(
        Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(""))
    );
    const [showSearch, setShowSearch] = useState(
        Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(false))
    );
    const [showColorWheel, setShowColorWheel] = useState(
        Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(false))
    );
    const [courseColors, setCourseColors] = useState(
        Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(""))
    );
    const [user, setUser] = useState(null);

    useEffect(() => {
        fetch("/courses.csv")
            .then((response) => response.text())
            .then((csvText) => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (result) => {
                        const formattedCourses = result.data.map(row => ({
                            tag: row["tag"] || "",
                            number: row["number"] || "",
                            course: row["course"] || "",
                            display: `${row["tag"]} ${row["number"]} - ${row["course"]}`
                        })).filter(course => course.tag && course.number && course.course);

                        setCourses(formattedCourses);
                    }
                });
            })
            .catch((error) => console.error("Error loading CSV:", error));
    }, []);

    const fuse = new Fuse(courses, {
        keys: ["tag", "number", "display"],
        threshold: 0.2,
        includeScore: false,
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                fetchUserCourses(currentUser.uid);
            } else {
                setUser(null);
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchUserCourses = async (userId) => {
        try {
            const userDoc = await getDoc(doc(db, "course_plans", userId));
            if (userDoc.exists()) {
                const coursesData = userDoc.data().plan || Array(NUM_TABLES * 18).fill(""); 
                const colorsData = userDoc.data().colors || Array(NUM_TABLES * 18).fill("");

                const restoredCourses = Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(""));
                const restoredColors = Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(""));

                coursesData.forEach(({ row, col, course }) => {
                    restoredCourses[row][col] = course;
                });

                if (colorsData.length > 0) {
                    colorsData.forEach(({ row, col, color }) => {
                        restoredColors[row][col] = color;
                    });
                    setCourseColors(restoredColors);
                }

                setSelectedCourses(restoredCourses);
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
        }
    };

    const saveCoursesToFirestore = async (newCourses, newColors = null) => {
        if (!user) return;

        const coursesAsObjects = newCourses.flatMap((row, rowIndex) =>
            row.map((course, colIndex) => ({
                row: rowIndex,
                col: colIndex,
                course: course || ""
            }))
        );

        const colorsToSave = newColors || courseColors;
        const colorsAsObjects = colorsToSave.flatMap((row, rowIndex) =>
            row.map((color, colIndex) => ({
                row: rowIndex,
                col: colIndex,
                color: color || ""
            }))
        );

        try {
            await setDoc(doc(db, "course_plans", user.uid), { 
                plan: coursesAsObjects,
                colors: colorsAsObjects
            });
            console.log("Courses and colors saved successfully!");
        } catch (error) {
            console.error("Error saving courses and colors:", error);
        }
    };

    const handleSearch = (query, row, col) => {
        const trimmedQuery = query.trim();

        setSearchQueries(prev => {
            const newQueries = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? query : val)) : r
            );
            return newQueries;
        });

        if (!trimmedQuery) {
            setSearchResults(prev => {
                const newResults = prev.map((r, rowIndex) =>
                    rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? [] : val)) : r
                );
                return newResults;
            });
            return;
        }

        let results = fuse.search(trimmedQuery).map(result => result.item);

        const queryParts = trimmedQuery.toLowerCase().split(" ");

        results = results.filter(course =>
            queryParts.every(part =>
                course.tag.toLowerCase().includes(part) ||
                course.number.includes(part) ||
                course.display.toLowerCase().includes(part)
            )
        );

        setSearchResults(prev => {
            const newResults = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? results : val)) : r
            );
            return newResults;
        });
    };

    const handleSelectCourse = (selectedCourse, row, col) => {
        setSelectedCourses(prev => {
            const newSelection = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? selectedCourse.display : val)) : r
            );
            saveCoursesToFirestore(newSelection);
            return newSelection;
        });

        setShowSearch(prev => {
            const newShowSearch = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? false : val)) : r
            );
            return newShowSearch;
        });
    };

    const handleSelectColor = (color, row, col) => {
        setCourseColors(prev => {
            const newColors = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? color : val)) : r
            );
            saveCoursesToFirestore(selectedCourses, newColors);
            return newColors;
        });

        setShowColorWheel(prev => {
            const newShowColorWheel = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? false : val)) : r
            );
            return newShowColorWheel;
        });
    };

    const toggleColorWheel = (row, col) => {
        setShowColorWheel(prev => {
            const newShowColorWheel = prev.map((r, rowIndex) =>
                rowIndex === row 
                    ? r.map((val, colIndex) => 
                        colIndex === col ? !val : false) 
                    : r.map(() => false)
            );
            return newShowColorWheel;
        });

        // Hide search when color wheel is shown
        setShowSearch(prev => {
            const newShowSearch = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? false : val)) : r
            );
            return newShowSearch;
        });
    };

    const ColorWheel = ({ row, col }) => (
        <div className="color-wheel">
            {COLOR_OPTIONS.map((color, index) => (
                <div 
                    key={index} 
                    className="color-option"
                    style={{ backgroundColor: color }}
                    onClick={() => handleSelectColor(color, row, col)}
                    title={color === "#36393F" ? "Reset color" : color}
                />
            ))}
        </div>
    );

    return (
        <div>
            {/* Header at the Top */}
            <header className="page-header">
                <h1>4-Year Plan</h1>
            </header>
    
            {[...Array(NUM_TABLES)].map((_, tableIndex) => (
                <div key={tableIndex} className="table-container">
                    <table className="course-table">
                        <thead>
                            <tr className="year-row">
                                <th colSpan="3" className="year-header">Year {tableIndex + 1}</th>
                            </tr>
                            <tr className="semester-row">
                                <th>Fall</th>
                                <th>Winter</th>
                                <th>Spring</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedCourses.slice(tableIndex * 6, (tableIndex + 1) * 6).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {row.map((value, colIndex) => (
                                        <td 
                                            key={colIndex} 
                                            className="search-container"
                                            style={{ 
                                                backgroundColor: courseColors[tableIndex * 6 + rowIndex][colIndex] || ""
                                            }}
                                        >
                                            {showSearch[tableIndex * 6 + rowIndex][colIndex] ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={searchQueries[tableIndex * 6 + rowIndex][colIndex]}
                                                        placeholder="Search for a course..."
                                                        onChange={(e) => handleSearch(e.target.value, tableIndex * 6 + rowIndex, colIndex)}
                                                        className="search-input"
                                                    />
                                                    {searchResults[tableIndex * 6 + rowIndex][colIndex].length > 0 && (
                                                        <ul className="search-results">
                                                            {searchResults[tableIndex * 6 + rowIndex][colIndex].map((course, index) => (
                                                                <li key={index} onClick={() => handleSelectCourse(course, tableIndex * 6 + rowIndex, colIndex)}>
                                                                    {course.display}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {value ? (
                                                        <div className="course-cell">
                                                            <div className="selected-course">{value}</div>
                                                            <div className="course-actions">
                                                                <button 
                                                                    className="edit-button" 
                                                                    onClick={() => setShowSearch(prev => {
                                                                        const newShowSearch = [...prev];
                                                                        newShowSearch[tableIndex * 6 + rowIndex][colIndex] = true;
                                                                        return newShowSearch;
                                                                    })}
                                                                >
                                                                    +
                                                                </button>
                                                                <button 
                                                                    className="color-button" 
                                                                    onClick={() => toggleColorWheel(tableIndex * 6 + rowIndex, colIndex)}
                                                                >
                                                                    🎨
                                                                </button>
                                                            </div>
                                                            {showColorWheel[tableIndex * 6 + rowIndex][colIndex] && (
                                                                <ColorWheel 
                                                                    row={tableIndex * 6 + rowIndex} 
                                                                    col={colIndex} 
                                                                />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="empty-cell">
                                                            <button 
                                                                className="add-button" 
                                                                onClick={() => setShowSearch(prev => {
                                                                    const newShowSearch = [...prev];
                                                                    newShowSearch[tableIndex * 6 + rowIndex][colIndex] = true;
                                                                    return newShowSearch;
                                                                })}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
};

export default FourYearPlan;