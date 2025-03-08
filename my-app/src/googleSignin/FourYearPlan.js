
import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import Fuse from "fuse.js";
import "./FourYearPlan.css";

const FourYearPlan = () => {
    const [courses, setCourses] = useState([]);
    const [searchResults, setSearchResults] = useState(
        Array.from({ length: 5 }, () => Array(3).fill([]))
    );
    const [searchQueries, setSearchQueries] = useState(
        Array.from({ length: 5 }, () => Array(3).fill(""))
    );
    const [selectedCourses, setSelectedCourses] = useState(
        Array.from({ length: 5 }, () => Array(3).fill(""))
    );
    const [showSearch, setShowSearch] = useState(
        Array.from({ length: 5 }, () => Array(3).fill(false))
    );

    useEffect(() => {
        fetch("/courses.csv")
            .then((response) => response.text())
            .then((csvText) => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (result) => {
                        console.log("Full Parsed CSV Data:", result.data);

                        if (result.errors.length > 0) {
                            console.error("CSV Parsing Errors:", result.errors);
                        }

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
        keys: ["tag", "number", "course", "display"],
        threshold: 0.4,
        includeScore: false,
    });

    const handleSearch = (query, row, col) => {
        setSearchQueries(prev => {
            const newQueries = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? query : val)) : r
            );
            return newQueries;
        });

        if (!query.trim()) {
            setSearchResults(prev => {
                const newResults = prev.map((r, rowIndex) =>
                    rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? [] : val)) : r
                );
                return newResults;
            });
            return;
        }

        const queryParts = query.toLowerCase().split(" ");
        const results = fuse.search(query).map(result => result.item)
            .filter(course => queryParts.every(part => course.display.toLowerCase().includes(part)));

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
            return newSelection;
        });

        setShowSearch(prev => {
            const newShowSearch = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? false : val)) : r
            );
            return newShowSearch;
        });
    };

    const toggleSearchVisibility = (row, col) => {
        setShowSearch(prev => {
            const newShowSearch = prev.map((r, rowIndex) =>
                rowIndex === row ? r.map((val, colIndex) => (colIndex === col ? !val : val)) : r
            );
            return newShowSearch;
        });
    };

    return (
        <div className="table-container">
            <table className="course-table">
                <thead>
                    <tr>
                        <th>Fall</th>
                        <th>Winter</th>
                        <th>Spring</th>
                    </tr>
                </thead>
                <tbody>
                    {selectedCourses.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((value, colIndex) => (
                                <td key={colIndex} className="search-container">
                                    {showSearch[rowIndex][colIndex] ? (
                                        <>
                                            <input
                                                type="text"
                                                value={searchQueries[rowIndex][colIndex]}
                                                placeholder="Search for a course..."
                                                onChange={(e) => handleSearch(e.target.value, rowIndex, colIndex)}
                                                className="search-input"
                                                onKeyDown={(e) => e.key === 'Enter' && handleSelectCourse(searchResults[rowIndex][colIndex][0], rowIndex, colIndex)}
                                            />
                                            {searchResults[rowIndex][colIndex].length > 0 && (
                                                <ul className="search-results">
                                                    {searchResults[rowIndex][colIndex].map((course, index) => (
                                                        <li key={index} onClick={() => handleSelectCourse(course, rowIndex, colIndex)}>
                                                            {course.display}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {selectedCourses[rowIndex][colIndex] ? (
                                                <>
                                                    <div className="selected-course">{selectedCourses[rowIndex][colIndex]}</div>
                                                    <button className="edit-button" onClick={() => toggleSearchVisibility(rowIndex, colIndex)}>+</button>
                                                </>
                                            ) : (
                                                <button className="add-button" onClick={() => toggleSearchVisibility(rowIndex, colIndex)}>+</button>
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
    );
};

export default FourYearPlan;