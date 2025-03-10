
import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import Fuse from "fuse.js";
import { auth, db, doc, setDoc, getDoc } from "./config"; // Firebase imports
import { onAuthStateChanged } from "firebase/auth";
import "./FourYearPlan.css";

const NUM_TABLES = 4; // Number of tables

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
        keys: ["tag", "number", "display"],  // 🔹 Remove "course" for better filtering
        threshold: 0.2,  // 🔹 Lower threshold for **stricter matching**
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

                const restoredCourses = Array.from({ length: NUM_TABLES * 6 }, () => Array(3).fill(""));

                coursesData.forEach(({ row, col, course }) => {
                    restoredCourses[row][col] = course;
                });

                setSelectedCourses(restoredCourses);
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
        }
    };

    const saveCoursesToFirestore = async (newCourses) => {
        if (!user) return;

        const coursesAsObjects = newCourses.flatMap((row, rowIndex) =>
            row.map((course, colIndex) => ({
                row: rowIndex,
                col: colIndex,
                course: course || ""
            }))
        );

        try {
            await setDoc(doc(db, "course_plans", user.uid), { plan: coursesAsObjects });
            console.log("Courses saved successfully!");
        } catch (error) {
            console.error("Error saving courses:", error);
        }
    };

    const handleSearch = (query, row, col) => {
        const trimmedQuery = query.trim(); // ✅ Remove unnecessary spaces
    
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
    
        // 🔹 Run Fuse.js search
        let results = fuse.search(trimmedQuery).map(result => result.item);
    
        // 🔹 Extract individual words from the query
        const queryParts = trimmedQuery.toLowerCase().split(" ");
    
        // 🔹 Filter results to match **any part** of the query (tag OR number OR full match)
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

    return (
        <div>
            {[...Array(NUM_TABLES)].map((_, tableIndex) => (
                <div className="table-container" key={tableIndex}>
                    <table className="course-table">
                        <thead>
                            <tr>
                                <th>Fall</th>
                                <th>Winter</th>
                                <th>Spring</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedCourses.slice(tableIndex * 6, (tableIndex + 1) * 6).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {row.map((value, colIndex) => (
                                        <td key={colIndex} className="search-container">
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
                                                        <>
                                                            <div className="selected-course">{value}</div>
                                                            <button className="edit-button" onClick={() => setShowSearch(prev => {
                                                                const newShowSearch = [...prev];
                                                                newShowSearch[tableIndex * 6 + rowIndex][colIndex] = true;
                                                                return newShowSearch;
                                                            })}>+</button>
                                                        </>
                                                    ) : (
                                                        <button className="add-button" onClick={() => setShowSearch(prev => {
                                                            const newShowSearch = [...prev];
                                                            newShowSearch[tableIndex * 6 + rowIndex][colIndex] = true;
                                                            return newShowSearch;
                                                        })}>+</button>
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
