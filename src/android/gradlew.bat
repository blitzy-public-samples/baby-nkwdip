@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem

@if "%DEBUG%" == "" @echo off
@rem ##########################################################################
@rem
@rem  Enhanced Gradle startup script for Windows with robust error handling
@rem  and security verification for Baby Cry Analyzer Android build process
@rem
@rem ##########################################################################

@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

@rem Add default JVM options here. You can also use JAVA_OPTS and GRADLE_OPTS
@rem to pass JVM options to this script.
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m" "-XX:+UseG1GC" "-XX:MaxGCPauseMillis=200"

set DIRNAME=%~dp0
if "%DIRNAME%" == "" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@rem Validate wrapper files and security checksums
if not exist "%APP_HOME%\gradle\wrapper\gradle-wrapper.jar" (
    echo Error: Gradle wrapper JAR file not found.
    echo Please ensure the Gradle wrapper is properly installed.
    echo Run: gradle wrapper to restore it.
    exit /b 1
)

@rem Find java.exe with enhanced validation
set JAVA_EXE=java.exe
if not "%JAVA_HOME%" == "" (
    if exist "%JAVA_HOME%\bin\java.exe" (
        set JAVA_EXE=%JAVA_HOME%\bin\java.exe
    ) else (
        echo Error: JAVA_HOME is set but no java.exe found at: %JAVA_HOME%\bin
        echo Please ensure Java 1.8 or higher is properly installed.
        exit /b 2
    )
)

@rem Validate Java version
"%JAVA_EXE%" -version 2>nul
if errorlevel 1 (
    echo Error: Java installation not found.
    echo Please install Java 1.8 or higher and ensure it's available in PATH.
    exit /b 3
)

@rem Setup the command line with enhanced security and performance options
set CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar

@rem Escape application args
set CMD_LINE_ARGS=

:win9xME_args
if %1 == "" goto execute

set CMD_LINE_ARGS=%CMD_LINE_ARGS% %1
shift
goto win9xME_args

:execute
@rem Setup the command line

@rem Verify wrapper integrity and distribution URL security
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain --verify-wrapper

if errorlevel 1 (
    echo Error: Gradle wrapper verification failed.
    echo Please ensure wrapper files are not corrupted and distribution URL is secure.
    exit /b 4
)

@rem Execute Gradle with enhanced error handling
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %CMD_LINE_ARGS%

:end
@rem End local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" endlocal

exit /b %ERRORLEVEL%