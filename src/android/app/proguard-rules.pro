# Baby Cry Analyzer ProGuard Rules
# Version 1.0.0

# Keep all annotations, signatures and inner classes
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-keepattributes JavascriptInterface

# React Native Core
-keep,allowobfuscation public class com.facebook.react.** { *; }
-keep,allowobfuscation public class com.facebook.hermes.** { *; }
-keep,allowobfuscation public class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# React Native Modules
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.react.bridge.ReactMethod
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod public *;
}

# Baby Cry Analyzer Native Modules
-keep class com.babycryanalyzer.audio.AudioCaptureModule { *; }
-keep class com.babycryanalyzer.audio.AudioProcessor { *; }
-keep class com.babycryanalyzer.**.BuildConfig { *; }
-keepclassmembers class com.babycryanalyzer.audio.* {
    public <methods>;
    native <methods>;
}

# TensorFlow Lite
-keep class org.tensorflow.lite.** { *; }
-keepclasseswithmembers class * {
    @org.tensorflow.lite.annotations.* <methods>;
}
-keep class org.tensorflow.lite.support.** { *; }
-keep interface org.tensorflow.lite.** { *; }

# Security Components
-keep class androidx.security.crypto.** { *; }
-keep class javax.crypto.** { *; }
-keep class javax.crypto.spec.** { *; }
-keep class java.security.** { *; }

# Firebase Messaging
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Kotlin Coroutines
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# Dagger/Hilt
-keepclassmembers,allowobfuscation class * {
    @javax.inject.* *;
    @dagger.* *;
    <init>();
}
-keep class dagger.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# Serialization
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Native Methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# View Bindings
-keep class * implements androidx.viewbinding.ViewBinding {
    public static ** bind(android.view.View);
    public static ** inflate(android.view.LayoutInflater);
}

# Optimization Settings
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-optimizationpasses 5
-allowaccessmodification
-dontpreverify

# Debugging Support
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable

# Misc
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn java.lang.invoke.**
-dontwarn javax.annotation.**
-dontwarn kotlin.**
-dontwarn kotlinx.**